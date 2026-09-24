import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, ClipboardList, HandCoins, Loader2, PackageCheck, Plus, Receipt, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MoneyStateBar } from '@/components/money-bar'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import {
  acceptedTotal,
  allocateDrafts,
  balanceOf,
  walletAvailable,
  type Balance,
  type ItemKey,
} from '@/domain/money'
import { cashboxOf } from '@/mock/cashboxes'
import { useStore } from '@/state/store'
import { useCard } from '@/features/rent/card-context'
import { StageRail } from '@/features/rent/StageRail'
import { PositionsList } from '@/features/rent/shared/PositionsList'
import { ChargeForm } from '@/features/rent/shared/ChargeForm'
import { CancelChargeDialog } from '@/features/rent/shared/CancelChargeDialog'
import { IntakeGate } from '@/features/rent/shared/IntakeGate'
import {
  CashboxChip,
  cashboxFor,
  coverWords,
  DocLabel,
  MethodDetails,
  MethodPicker,
  methodsFor,
} from '@/features/rent/shared/intake-kit'
import { METHOD_META, MethodTile } from '@/features/rent/method-meta'
import type { Charge, Cover, Draft, MethodKind, Rent } from '@/mock/types'

/**
 * Варіант A — «Рядок способу».
 *
 * Найменша зміна проду: способи лишаються таблицею (рішення 30.07), але
 * поповера-майстра і розгорнутого рядка немає. Рядок існує з першої
 * секунди; спосіб обирається перемикачем у самому рядку — навмисно без
 * підстановки (явний вибір, 2 кліки у сцені 1). Каса — окремий чип із
 * власним поповером. Колонка «Рахунок» стала «Покриває». Головна дія —
 * у рядку праворуч, на тому самому місці до й після вибору способу.
 *
 * «Рахунки до оплати» — варіант (а): список позицій замість карток,
 * нарахування — окремим блоком, як 04.09.
 */
export function StepA() {
  const { rent, dispatch } = useStore()
  const { chargeForm, closeChargeForm, openChargeForm, railOwnsRemaining } = useCard()
  const bal = balanceOf(rent)
  const [cancelling, setCancelling] = useState<Charge | null>(null)
  const live = rent.payments.filter((p) => !p.annulled)
  const hasCharges = rent.charges.length > 0

  // Рядок способу є завжди, поки є що приймати. Прапорець не дає
  // StrictMode завести два рядки за одне монтування.
  const adding = useRef(false)
  useEffect(() => {
    if (rent.drafts.length > 0) {
      adding.current = false
      return
    }
    if (bal.remaining > 0 && !adding.current) {
      adding.current = true
      dispatch({ type: 'DRAFT_ADD' })
    }
  }, [bal.remaining, rent.drafts.length, dispatch])

  const intakeTone = bal.remaining <= 0 ? 'done' : live.length > 0 ? 'partial' : 'current'

  return (
    <StageRail testId="payment-stage">
      <StageRail.Step
        key="invoices"
        tone="done"
        icon={Receipt}
        label="Рахунки до оплати"
        heading
        aside={
          !chargeForm && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => openChargeForm('charge')} data-testid="add-charge">
                <Plus className="size-3.5" aria-hidden />
                Нарахування
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openChargeForm('discount')} data-testid="add-discount">
                <Plus className="size-3.5" aria-hidden />
                Знижка
              </Button>
            </div>
          )
        }
      >
        <PositionsList rent={rent} bal={bal} mode="positions" editable={live.length === 0} />
      </StageRail.Step>

      {(hasCharges || chargeForm) && (
        <StageRail.Step
          key="charges"
          tone={chargeForm ? 'editing' : bal.chargesRemaining > 0 ? 'ready' : 'done'}
          icon={ReceiptText}
          label="Доп. нарахування"
          heading
        >
          <div className="flex flex-col gap-3">
            {chargeForm && <ChargeForm kind={chargeForm} onDone={closeChargeForm} onCancel={closeChargeForm} />}
            {hasCharges && <PositionsList rent={rent} bal={bal} mode="charges" onCancelCharge={setCancelling} />}
          </div>
          <CancelChargeDialog charge={cancelling} onClose={() => setCancelling(null)} />
        </StageRail.Step>
      )}

      <StageRail.Step
        key="intake"
        tone={intakeTone}
        icon={HandCoins}
        label="Прийом коштів"
        heading
        aside={
          !railOwnsRemaining && (
            <span className="flex items-baseline gap-2" data-remaining="step-heading">
              <span className="text-label text-muted-fg">{bal.remaining > 0 ? 'До прийому' : 'Прийнято все'}</span>
              <span className="text-headline font-semibold tabular-nums">{formatMoney(bal.remaining)}</span>
            </span>
          )
        }
        testId="step-intake"
      >
        <div data-step="intake" className="flex flex-col gap-3">
          <GroupBars bal={bal} />
          <MethodsTableA />
        </div>
      </StageRail.Step>

      <StageRail.Step key="registry" tone={bal.remaining <= 0 ? 'done' : 'idle'} icon={ClipboardList} label="Реєстр платежів">
        <RegistryLine rent={rent} />
      </StageRail.Step>

      <StageRail.Step key="issue" tone={bal.remaining <= 0 ? 'done' : 'idle'} icon={PackageCheck} label="Видача">
        <IntakeGate />
      </StageRail.Step>
    </StageRail>
  )
}

export function RegistryLine({ rent }: { rent: Rent }) {
  const n = rent.payments.filter((p) => !p.annulled).length
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-body" data-testid="registry-row">
      <span className={n ? 'text-fg-2' : 'text-muted-fg'}>
        {n ? (
          <>
            Прийнято <span className="font-semibold tabular-nums text-fg">{formatMoney(acceptedTotal(rent))}</span> — {n}{' '}
            {plural(n, 'платіж', 'платежі', 'платежів')}
          </>
        ) : (
          'Платежів ще не було'
        )}
      </span>
      <span className="flex items-center gap-1 text-fg-2 underline underline-offset-2">
        Реєстр платежів <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </div>
  )
}

/**
 * Смуги груп: оренда, нарахування (окремий сегмент, §5), застава. Смуга
 * показує СТАН групи — оплачено / чекаємо — і не друкує залишок: число
 * «скільки ще» стоїть у заголовку кроку.
 */
export function GroupBars({ bal }: { bal: Balance }) {
  const groups = [
    { key: 'rent', label: 'Оренда', due: bal.rent.due, paid: Math.min(bal.rent.paid, bal.rent.due), tone: 'success' as const },
    { key: 'charges', label: 'Нарахування', due: bal.chargesDue, paid: Math.min(bal.chargesPaid, bal.chargesDue), tone: 'success' as const },
    { key: 'deposit', label: 'Застава', due: bal.deposit.due, paid: Math.min(bal.deposit.paid, bal.deposit.due), tone: 'accent' as const },
  ].filter((g) => g.due > 0)
  if (groups.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2" data-testid="group-bars">
      {groups.map((g) => (
        <div key={g.key} className="flex min-w-[120px] flex-col gap-1.5" style={{ flex: `${Math.max(g.due, 1)} 1 0` }}>
          <span className="flex items-baseline justify-between gap-2 text-label text-muted-fg">
            <span className="font-medium">{g.label}</span>
            <span className="tabular-nums">
              {g.paid >= g.due ? 'оплачено' : g.paid > 0 ? `${formatAmount(g.paid)} з ${formatAmount(g.due)}` : formatAmount(g.due)}
            </span>
          </span>
          <MoneyStateBar
            total={g.due}
            paidTone={g.tone}
            named="missing"
            segments={[
              { state: 'here', amount: g.paid, label: 'Оплачено' },
              { state: 'missing', amount: g.due - g.paid, label: 'Чекаємо' },
            ]}
          />
        </div>
      ))}
    </div>
  )
}

/* ── Таблиця способів ──────────────────────────────────────────────── */

function MethodsTableA() {
  const { rent, dispatch } = useStore()
  const bal = balanceOf(rent)
  const drafts = rent.drafts
  const allocs = allocateDrafts(
    bal,
    drafts.map((d) => ({ ...d, amount: d.amount || Number.MAX_SAFE_INTEGER })),
  )
  const payments = rent.payments
  const [busy, setBusy] = useState<string | null>(null)

  const accept = (d: Draft, amount: number) => {
    if (!d.method) return
    setBusy(d.id)
    window.setTimeout(() => {
      dispatch({
        type: 'ACCEPT',
        draftId: d.id,
        method: d.method!,
        cashboxId: d.cashboxId,
        amount,
        items: d.items,
        target: d.target,
        invoiceId: d.invoiceId,
      })
      setBusy(null)
    }, 180)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" data-testid="methods-a">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col />
          <col className="w-[9.5rem]" />
          <col className="w-[9rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[10rem]" />
        </colgroup>
        <thead>
          <tr className="bg-muted/30 text-mono uppercase tracking-[0.04em] text-muted-fg [&>th]:border-b [&>th]:border-border [&>th]:py-1.5 [&>th]:font-semibold">
            <th className="px-2.5 text-left">Спосіб</th>
            <th className="pr-2 text-left">Каса</th>
            <th className="pr-2 text-left">Покриває</th>
            <th className="pr-2 text-right">Сума</th>
            <th className="pr-2.5 text-right">
              <span className="sr-only">Дія</span>
            </th>
          </tr>
        </thead>
        {payments.map((p) => (
          <tbody key={p.id} data-payment={p.id}>
            <tr className={cn('h-12 border-b border-border', p.annulled && 'bg-muted/30')}>
              <td className="px-2.5">
                <span className={cn('flex items-center gap-2', p.annulled && 'opacity-60')}>
                  <MethodTile method={p.method} size="sm" />
                  <span className={cn('truncate text-body font-medium', p.annulled && 'line-through')}>{METHOD_META[p.method].short}</span>
                </span>
              </td>
              <td className="pr-2 text-label text-muted-fg">
                <span className="line-clamp-2">{cashboxOf(p.cashboxId)?.name ?? 'гаманець клієнта'}</span>
              </td>
              <td className="pr-2 text-label text-fg-2">
                <span className="line-clamp-2">{coverWords(rent, p.cover)}</span>
              </td>
              <td className={cn('pr-2 text-right text-body font-semibold tabular-nums', p.annulled && 'text-muted-fg line-through')}>
                {formatAmount(p.booked1c?.amount ?? p.amount)}
              </td>
              <td className="pr-2.5 text-right">
                <DocLabel payment={p} />
              </td>
            </tr>
          </tbody>
        ))}
        {drafts.map((d, i) => (
          <DraftRowA
            key={d.id}
            draft={d}
            bal={bal}
            room={allocs.get(d.id)!.room}
            cover={allocs.get(d.id)!.cover}
            first={i === 0}
            busy={busy === d.id}
            onAccept={(amount) => accept(d, amount)}
          />
        ))}
      </table>
      {bal.remaining > 0 && drafts.every((d) => d.method) && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'DRAFT_ADD' })}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-body text-muted-fg hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
          data-testid="add-method-row"
        >
          <Plus className="size-4" aria-hidden />
          Ще один спосіб
        </button>
      )}
    </div>
  )
}

function DraftRowA({
  draft,
  bal,
  room,
  cover,
  first,
  busy,
  onAccept,
}: {
  draft: Draft
  bal: Balance
  room: number
  cover: Cover
  first: boolean
  busy: boolean
  onAccept: (amount: number) => void
}) {
  const { rent, dispatch } = useStore()
  const [text, setText] = useState<string | null>(null)
  const effective = draft.amount || room
  const invoice = rent.invoices.find((i) => i.id === draft.invoiceId && !i.cancelled)
  const overCap = draft.method === 'balance' && effective > walletAvailable(rent)
  const over = effective > room
  const blocked = !draft.method ? 'Оберіть спосіб' : effective <= 0 ? 'Нічого приймати' : overCap ? 'На гаманці менше' : over ? 'Більше, ніж лишилось' : null

  const pick = (m: MethodKind) => {
    const patch: Partial<Draft> = { method: m, cashboxId: cashboxFor(m, rent) }
    if (m === 'balance') patch.amount = Math.min(room, walletAvailable(rent))
    dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch })
    // Юрособа, переказ: оренда з ПДВ і застава без ПДВ — два рахунки, два рядки.
    if (m === 'bank' && rent.party === 'ul' && draft.target === 'rent' && bal.deposit.remaining > 0 && !rent.drafts.some((x) => x.target === 'deposit')) {
      dispatch({ type: 'DRAFT_ADD', draft: { method: 'bank', cashboxId: cashboxFor('bank', rent), target: 'deposit' } })
    }
  }

  const label =
    draft.method === 'bank' ? 'Підтвердити' : draft.method === 'balance' ? 'Списати' : 'Прийняти'

  return (
    <tbody data-draft={draft.id}>
      <tr className="h-12 border-b border-border">
        <td className="px-2.5">
          <MethodPicker
            value={draft.method}
            methods={methodsFor(rent.party, rent.counterparty.wallet)}
            wallet={walletAvailable(rent) || undefined}
            onChange={pick}
            testId={first ? 'method' : `method-${draft.id}`}
            size="sm"
          />
        </td>
        <td className="pr-2">
          {draft.method ? (
            <CashboxChip
              method={draft.method}
              value={draft.cashboxId}
              onChange={(id) => dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { cashboxId: id } })}
              testId={first ? 'cashbox-chip' : `cashbox-chip-${draft.id}`}
            />
          ) : (
            <span className="text-label text-subtle">—</span>
          )}
        </td>
        <td className="pr-2">
          <CoverPicker draft={draft} bal={bal} words={coverWords(rent, cover) || '—'} />
        </td>
        <td className="pr-2">
          <div className="relative">
            <input
              inputMode="decimal"
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Сума"
              value={text ?? formatAmount(effective)}
              onChange={(e) => setText(e.target.value.replace(/[^\d\s,.]/g, ''))}
              onBlur={() => {
                if (text == null) return
                const v = Number(text.replace(/\s/g, '').replace(',', '.')) || 0
                dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { amount: v } })
                setText(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              data-testid={first ? 'amount' : `amount-${draft.id}`}
              className={cn(
                'h-7 w-full rounded-md border border-border-strong bg-card pl-2 pr-5 text-right text-body font-medium tabular-nums outline-none focus:border-fg/50',
                over && 'text-danger-fg',
              )}
            />
            <span className="pointer-events-none absolute inset-y-0 right-1.5 grid place-items-center text-body text-muted-fg">₴</span>
          </div>
        </td>
        <td className="pr-2.5 text-right">
          <Button
            size="sm"
            className="w-full"
            disabled={!!blocked || busy}
            onClick={() => onAccept(effective)}
            data-testid={first ? 'accept' : `accept-${draft.id}`}
            data-main-action={first ? 'intake' : undefined}
            title={blocked ?? undefined}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {label} {formatAmount(effective)}
          </Button>
        </td>
      </tr>
      {draft.method && draft.method !== 'cash' && (
        <tr className="border-b border-border">
          <td colSpan={5} className="bg-muted/20 px-2.5 py-2.5">
            <MethodDetails
              method={draft.method}
              cashboxId={draft.cashboxId}
              amount={effective}
              target={draft.target}
              invoice={invoice}
              onIssueInvoice={
                draft.method === 'bank'
                  ? () =>
                      dispatch({
                        type: 'INVOICE_ISSUE',
                        draftId: draft.id,
                        group: rent.party === 'fl' ? 'all' : draft.target === 'deposit' ? 'deposit' : 'rent',
                        amount: effective,
                      })
                  : undefined
              }
            />
          </td>
        </tr>
      )}
    </tbody>
  )
}

/** «Покриває: оренда, застава — змінити». Поповер постійного розміру з галочками. */
function CoverPicker({ draft, bal, words }: { draft: Draft; bal: Balance; words: string }) {
  const { dispatch } = useStore()
  const keys: { key: ItemKey; label: string; amount: number }[] = [
    { key: 'rent', label: 'Оренда', amount: bal.rent.remaining },
    ...bal.charges.filter((c) => !c.charge.cancelled && c.remaining > 0).map((c) => ({ key: c.charge.id, label: c.charge.article, amount: c.remaining })),
    { key: 'deposit', label: 'Застава', amount: bal.deposit.remaining },
  ].filter((k) => k.amount > 0)
  const selected = draft.items ?? keys.map((k) => k.key)
  const toggle = (key: ItemKey, on: boolean) => {
    const next = on ? [...new Set([...selected, key])] : selected.filter((k) => k !== key)
    dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { items: next, amount: 0 } })
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="cover-trigger"
          className="flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-label text-fg-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          <span className="line-clamp-2">{words}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-fg" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2" data-popover-id="cover">
        <p className="px-1.5 pb-1.5 text-label text-muted-fg">Що закриває цей платіж</p>
        <ul className="flex flex-col">
          {keys.map((k) => (
            <li key={k.key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-body hover:bg-muted">
                <Checkbox checked={selected.includes(k.key)} onCheckedChange={(v) => toggle(k.key, v === true)} data-testid={`cover-${k.key}`} />
                <span className="min-w-0 flex-1 truncate">{k.label}</span>
                <span className="tabular-nums text-muted-fg">{formatAmount(k.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
