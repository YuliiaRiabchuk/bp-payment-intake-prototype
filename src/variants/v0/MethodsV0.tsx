import { useEffect, useRef, useState } from 'react'
import { CirclePlus, Plus, ReceiptText, ShieldCheck } from 'lucide-react'
import { Callout } from '@/components/ui/callout'
import { Button } from '@/components/ui/button'
import { MoneyStateBar } from '@/components/money-bar'
import { formatMoney } from '@/lib/money'
import { allocateDrafts, balanceOf, coverCharges, type Balance } from '@/domain/money'
import { useStore } from '@/state/store'
import { DraftRowV0, AcceptedRowV0, MethodTableV0 } from './RowsV0'
import type { Preset } from './AmountEditorV0'
import type { Draft } from '@/mock/types'

/**
 * Варіант 0 — «Прийом коштів» як у проді (кадри 1, 5–7, 9, 10).
 *
 * Дві смуги (оренда, застава), під ними таблиця способів, де відкритий
 * рівно один рядок. «Додайте спосіб оплати» → поповер-майстер → «Готово» →
 * поповер суми → рядок розгортається сам → «Прийняти» в правій половині.
 * Нарахування подовжують смугу оренди, окремого сегмента немає.
 */

export function MoneyBarV0({ bal }: { bal: Balance }) {
  const rentTotal = Math.max(bal.rentAccount.due, bal.rentAccount.paid)
  const depositTotal = Math.max(bal.deposit.due, bal.deposit.paid)
  const settled = bal.remaining <= 0
  const twoAccounts = depositTotal > 0
  if (settled && !twoAccounts) return null
  const cols = [
    {
      key: 'rent',
      icon: <ReceiptText className="size-3.5" aria-hidden />,
      label: 'Оренда',
      paid: Math.min(bal.rentAccount.due, bal.rentAccount.paid),
      missing: bal.rentAccount.remaining,
      over: Math.max(0, bal.rentAccount.paid - bal.rentAccount.due),
      total: rentTotal,
      tone: 'success' as const,
    },
    {
      key: 'deposit',
      icon: <ShieldCheck className="size-3.5" aria-hidden />,
      label: 'Застава',
      paid: Math.min(bal.deposit.due, bal.deposit.paid),
      missing: bal.deposit.remaining,
      over: 0,
      total: depositTotal,
      tone: 'accent' as const,
    },
  ].filter((c) => c.total > 0)
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2" data-testid="v0-money-bar">
      {cols.map((c) => (
        <div key={c.key} className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-label font-medium text-muted-fg">
            {c.icon}
            {c.label}
          </span>
          <div data-remaining={c.missing > 0 ? `bar-${c.key}` : undefined}>
            <MoneyStateBar
              total={c.total}
              paidTone={c.tone}
              segments={[
                { state: 'here', amount: c.paid, label: 'Оплачено' },
                { state: 'missing', amount: c.missing, label: 'Не оплачено' },
                { state: 'over', amount: c.over, label: 'Переплата' },
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function presetsFor(bal: Balance, draft: Draft, room: number, party: 'fl' | 'ul'): Preset[] {
  if (room <= 0) return []
  if (party === 'ul' || draft.target !== 'auto') return [{ key: 'all', label: 'Увесь залишок', amount: room }]
  const out: Preset[] = [{ key: 'all', label: 'Увесь залишок', amount: room, target: 'auto' }]
  const rentRoom = Math.min(room, bal.rentAccount.remaining)
  const depRoom = Math.min(room, bal.deposit.remaining)
  if (rentRoom > 0 && rentRoom !== room) out.push({ key: 'rent', label: 'Оренда', amount: rentRoom, target: 'rent' })
  if (depRoom > 0 && depRoom !== room) out.push({ key: 'deposit', label: 'Застава', amount: depRoom, target: 'deposit' })
  return out
}

export function MethodsV0() {
  const { rent, dispatch } = useStore()
  const bal = balanceOf(rent)
  const [openId, setOpenId] = useState<string | null>(null)
  const [setupId, setSetupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const pendingSetup = useRef(false)
  const prevAmounts = useRef(new Map<string, number>())

  const drafts = rent.drafts
  const allocs = allocateDrafts(bal, drafts)
  const live = rent.payments.filter((p) => !p.annulled)
  const settled = bal.remaining <= 0
  const vat = bal.rate > 0

  // Новий рядок одразу відкриває свій поповер (як «Додати спосіб» у CRM).
  useEffect(() => {
    if (pendingSetup.current && drafts.length > 0) {
      pendingSetup.current = false
      setSetupId(drafts[drafts.length - 1].id)
      setOpenId(null)
    }
  }, [drafts])

  // Перша сума на налаштованому рядку розгортає його.
  useEffect(() => {
    for (const d of drafts) {
      const prev = prevAmounts.current.get(d.id) ?? 0
      if (prev === 0 && d.amount > 0 && d.method) setOpenId(d.id)
      prevAmounts.current.set(d.id, d.amount)
    }
  }, [drafts])

  const addMethod = () => {
    pendingSetup.current = true
    dispatch({ type: 'DRAFT_ADD' })
  }

  const accept = (d: Draft) => {
    if (!d.method) return
    setBusy(d.id)
    // Затримка — коротка відповідь сервера: рядок збирається, потім
    // зникає, і на його місці з'являється прийнятий (як у проді).
    window.setTimeout(() => {
      dispatch({
        type: 'ACCEPT',
        draftId: d.id,
        method: d.method!,
        cashboxId: d.cashboxId,
        amount: d.amount,
        items: d.items,
        target: d.target,
        invoiceId: d.invoiceId,
      })
      setBusy(null)
      setOpenId(null)
    }, 220)
  }

  const unconfigured = drafts.find((d) => !d.method || (d.method !== 'balance' && !d.cashboxId))
  const shortfalls = shortfallOf(bal, drafts, allocs)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" data-testid="v0-methods">
      <MoneyBarV0 bal={bal} />
      {drafts.length === 0 && live.length === 0 && !settled ? (
        <button
          type="button"
          onClick={addMethod}
          data-testid="add-method-block"
          data-main-action="intake"
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-muted/20 py-7 text-body text-muted-fg hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          <CirclePlus className="size-5" aria-hidden />
          Додайте спосіб оплати
        </button>
      ) : (
        <MethodTableV0 vat={vat}>
          {live.map((p) => (
            <AcceptedRowV0
              key={p.id}
              payment={p}
              bal={bal}
              vat={vat}
              expanded={openId === p.id}
              onToggle={() => setOpenId((v) => (v === p.id ? null : p.id))}
            />
          ))}
          {drafts.map((d) => {
            const a = allocs.get(d.id)!
            return (
              <DraftRowV0
                key={d.id}
                draft={d}
                bal={bal}
                cover={a.cover}
                room={a.room}
                vat={vat}
                presets={presetsFor(bal, d, a.room, rent.party)}
                expanded={openId === d.id}
                setupOpen={setupId === d.id}
                focusSignal={focus?.id === d.id ? focus.n : 0}
                busy={busy === d.id}
                onToggle={() => setOpenId((v) => (v === d.id ? null : d.id))}
                onSetupOpenChange={(v) => setSetupId(v ? d.id : null)}
                onSetupDone={() => {
                  setSetupId(null)
                  if (d.amount > 0) setOpenId(d.id)
                  else window.setTimeout(() => setFocus({ id: d.id, n: Date.now() }), 30)
                }}
                onAmount={(v) => dispatch({ type: 'DRAFT_PATCH', id: d.id, patch: { amount: v } })}
                onPreset={(p) =>
                  dispatch({
                    type: 'DRAFT_PATCH',
                    id: d.id,
                    patch: { amount: p.amount, ...(p.target && rent.party === 'fl' ? { target: p.target } : {}) },
                  })
                }
                onAccept={() => accept(d)}
              />
            )
          })}
          {!settled && (
            <tbody>
              <tr>
                <td colSpan={vat ? 6 : 5} className="border-t border-border p-0">
                  <button
                    type="button"
                    onClick={addMethod}
                    disabled={!!unconfigured}
                    data-testid="add-method-row"
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-body text-muted-fg hover:bg-muted/40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
                  >
                    <Plus className="size-4" aria-hidden />
                    Додати спосіб
                    {unconfigured && (
                      <span className="text-label text-subtle">
                        — {unconfigured.method ? 'спочатку оберіть касу в рядку вище' : 'спочатку оберіть спосіб у рядку вище'}
                      </span>
                    )}
                  </button>
                </td>
              </tr>
            </tbody>
          )}
        </MethodTableV0>
      )}
      {shortfalls.map((s) => (
        <Callout
          key={s.key}
          variant="warning"
          action={
            drafts.length === 1 ? (
              <Button
                size="sm"
                variant="warning"
                onClick={() =>
                  dispatch({ type: 'DRAFT_PATCH', id: drafts[0].id, patch: { amount: drafts[0].amount + s.left, target: 'auto' } })
                }
              >
                Доповнити
              </Button>
            ) : undefined
          }
        >
          <span data-remaining="shortfall">
            {s.label}: {formatMoney(s.covered)} з {formatMoney(s.due)}, залишок {formatMoney(s.left)} не покрито способами оплати
          </span>
        </Callout>
      ))}
    </div>
  )
}

function shortfallOf(
  bal: Balance,
  drafts: Draft[],
  allocs: ReturnType<typeof allocateDrafts>,
): { key: string; label: string; covered: number; due: number; left: number }[] {
  const active = drafts.filter((d) => d.method && d.amount > 0)
  if (active.length === 0) return []
  let rent = 0
  let dep = 0
  for (const d of active) {
    const c = allocs.get(d.id)!.cover
    rent += c.rent + coverCharges(c)
    dep += c.deposit
  }
  const out = []
  if (bal.rentAccount.remaining > rent)
    out.push({ key: 'rent', label: 'Рахунок оренди', covered: rent, due: bal.rentAccount.remaining, left: bal.rentAccount.remaining - rent })
  if (bal.deposit.remaining > dep)
    out.push({ key: 'dep', label: 'Рахунок застави', covered: dep, due: bal.deposit.remaining, left: bal.deposit.remaining - dep })
  return out
}

export function intakeNode(bal: Balance, anyPayment: boolean) {
  if (bal.remaining <= 0) return { tone: 'done' as const, pill: 'Оплачено' }
  if (anyPayment) return { tone: 'partial' as const, pill: 'Часткова оплата' }
  return { tone: 'current' as const, pill: 'До приймання' }
}

