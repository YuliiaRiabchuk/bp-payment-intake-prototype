import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ClipboardList, HandCoins, Landmark, Loader2, PackageCheck, Plus, Receipt, ShieldCheck, Split, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { balanceOf, chargeGross, gross, itemsOfTarget, lineNet, roomOf, walletAvailable, type Balance, type ItemKey } from '@/domain/money'
import { cashboxOf } from '@/mock/cashboxes'
import { useStore } from '@/state/store'
import { useCard } from '@/features/rent/card-context'
import { StageRail } from '@/features/rent/StageRail'
import { calcLine, CancelledCharges, serviceName } from '@/features/rent/shared/PositionsList'
import { ChargeForm } from '@/features/rent/shared/ChargeForm'
import { CancelChargeDialog } from '@/features/rent/shared/CancelChargeDialog'
import { IntakeGate } from '@/features/rent/shared/IntakeGate'
import { CashboxChip, cashboxFor, InvoiceLine, MethodPicker, PaymentsLedger } from '@/features/rent/shared/intake-kit'
import { Requisites, purposeOf } from '@/features/rent/shared/Requisites'
import { RegistryLine } from '@/variants/a/StepA'
import { METHOD_META } from '@/features/rent/method-meta'
import type { Charge, MethodKind } from '@/mock/types'

/**
 * Варіант D — «Швидкі дії».
 *
 * Найкоротший шлях для стійки: крок відповідає одним реченням («Прийняти
 * 5 100 грн: оренда 2 100 і застава 3 000») і одним рядом дій. Перша дія —
 * первинна: «Готівкою — Каса Куренівка», один клік приймає все. Решта —
 * вторинні: термінал, переказ (бокова панель з реквізитами), з балансу,
 * «Розділити…». Прийняті платежі стоять ПІД рядом дій, тож ряд не їде вниз.
 *
 * «Рахунки до оплати» — контроль гіпотези продакта: картки лишаються, але
 * кожна розкривається в склад. Перевіряємо, чи вистачає розкриття замість
 * списку.
 */
export function StepD() {
  const { rent } = useStore()
  const { chargeForm, closeChargeForm, openChargeForm } = useCard()
  const bal = balanceOf(rent)
  const live = rent.payments.filter((p) => !p.annulled)

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
        <div className="flex flex-col gap-3">
          {chargeForm && <ChargeForm kind={chargeForm} onDone={closeChargeForm} onCancel={closeChargeForm} />}
          <AccountCards bal={bal} />
        </div>
      </StageRail.Step>

      <StageRail.Step
        key="intake"
        tone={bal.remaining <= 0 ? 'done' : live.length ? 'partial' : 'current'}
        icon={HandCoins}
        label="Прийом коштів"
        heading
        testId="step-intake"
      >
        <div data-step="intake" className="flex flex-col gap-3">
          <QuickActions />
          <PaymentsLedger rent={rent} />
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

/* ── Картки з розкриттям складу ─────────────────────────────────────── */

function AccountCards({ bal }: { bal: Balance }) {
  const { rent } = useStore()
  const [cancelling, setCancelling] = useState<Charge | null>(null)
  const liveCharges = rent.charges.filter((c) => !c.cancelled)
  const cancelled = rent.charges.filter((c) => c.cancelled)
  return (
    <div className={cn('grid gap-3', liveCharges.length || cancelled.length ? 'sm:grid-cols-3' : 'sm:grid-cols-2')} data-testid="account-cards">
      <AccountCard icon={<Wallet className="size-3.5 text-muted-fg" aria-hidden />} title="Оренда" amount={bal.rent.gross} note={bal.rate > 0 ? `з ПДВ ${bal.rate} %` : undefined} settled={bal.rent.due > 0 && bal.rent.remaining === 0}>
        <ul className="flex flex-col gap-1.5">
          {rent.positions.map((p) => (
            <li key={p.id} className="text-label">
              <span className="block break-words text-fg">{serviceName(rent, p)}</span>
              <span className="flex justify-between gap-2 text-muted-fg">
                <span>{calcLine(p)}</span>
                <span className="tabular-nums text-fg-2">{formatAmount(gross(lineNet(p), bal.rate))}</span>
              </span>
              {p.parts && (
                <span className="block text-subtle">
                  у комплекті: {p.parts.map((x) => `${x.name.split(' ').slice(0, 2).join(' ')} ×${x.qty}`).join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </AccountCard>
      <AccountCard icon={<ShieldCheck className="size-3.5 text-muted-fg" aria-hidden />} title="Застава" amount={bal.deposit.due} note={bal.deposit.due === 0 ? 'не береться' : rent.party === 'ul' ? 'без ПДВ' : undefined} settled={bal.deposit.due > 0 && bal.deposit.remaining === 0}>
        <ul className="flex flex-col gap-1">
          {rent.positions
            .filter((p) => p.kind !== 'consumable' && p.deposit > 0)
            .map((p) => (
              <li key={p.id} className="flex justify-between gap-2 text-label">
                <span className="min-w-0 text-muted-fg">{p.name}</span>
                <span className="tabular-nums text-fg-2">{formatAmount(p.qty * p.deposit)}</span>
              </li>
            ))}
        </ul>
      </AccountCard>
      {(liveCharges.length > 0 || cancelled.length > 0) && (
        <AccountCard
          icon={<Receipt className="size-3.5 text-muted-fg" aria-hidden />}
          title="Нарахування"
          amount={bal.chargesDue - bal.rent.discount}
          note="окремо від оренди"
          settled={bal.chargesDue > 0 && bal.chargesRemaining === 0}
        >
          <ul className="flex flex-col gap-1">
            {liveCharges.map((c) => {
              const cb = bal.charges.find((x) => x.charge.id === c.id)
              return (
                <li key={c.id} className="flex items-baseline justify-between gap-2 text-label">
                  <span className="min-w-0 text-muted-fg">
                    {c.article}
                    <span className="text-subtle"> — {c.kind === 'discount' ? 'знижка' : c.vatable && bal.rate > 0 ? `з ПДВ ${bal.rate} %` : 'без ПДВ'}</span>
                    {c.kind === 'charge' && (
                      <span className={cn('block', (cb?.remaining ?? 0) <= 0 ? 'text-success-fg' : 'text-subtle')}>
                        {(cb?.remaining ?? 0) <= 0 ? 'оплачено' : 'не оплачено'}
                        {' — '}
                        <button type="button" onClick={() => setCancelling(c)} className="underline underline-offset-2 hover:text-fg">
                          скасувати
                        </button>
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-fg-2">{formatAmount((c.kind === 'discount' ? -1 : 1) * chargeGross(c, bal.rate))}</span>
                </li>
              )
            })}
          </ul>
          {cancelled.length > 0 && <div className="-mx-3 mt-2"><CancelledCharges charges={cancelled} rate={bal.rate} /></div>}
        </AccountCard>
      )}
      <CancelChargeDialog charge={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}

function AccountCard({
  icon,
  title,
  amount,
  note,
  settled,
  children,
}: {
  icon: React.ReactNode
  title: string
  amount: number
  note?: string
  settled?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3" data-testid={`card-${title}`}>
      <div className="flex min-h-6 items-center gap-1.5">
        {icon}
        <span className="text-body font-medium text-fg-2">{title}</span>
        {note && <span className="text-label text-muted-fg">{note}</span>}
        {settled && <span className="ml-auto text-label text-success-fg">оплачено</span>}
      </div>
      <div className="text-headline font-semibold leading-none tabular-nums">{formatMoney(amount)}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="-ml-1 flex w-fit items-center gap-1 rounded-sm px-1 text-label text-fg-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        data-testid={`disclose-${title}`}
      >
        <ChevronRight className={cn('size-3 transition-transform duration-200', open && 'rotate-90')} aria-hidden />
        Склад
      </button>
      {open && <div className="border-t border-border pt-2">{children}</div>}
    </div>
  )
}

/* ── Речення + ряд дій ──────────────────────────────────────────────── */

function QuickActions() {
  const { rent, dispatch } = useStore()
  const { railOwnsRemaining } = useCard()
  const bal = balanceOf(rent)
  const pending = rent.drafts.filter((d) => d.method === 'bank' && d.invoiceId)
  const reserved = pending.reduce((s, d) => s + d.amount, 0)
  const free = Math.max(0, bal.remaining - reserved)
  const [custom, setCustom] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [cashbox, setCashbox] = useState<string | null>(() => cashboxFor('cash', rent))
  const [split, setSplit] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const paidCount = rent.payments.length
  useEffect(() => {
    setCustom(null)
    setSplit(false)
  }, [paidCount])

  const amount = Math.min(custom ?? free, free)
  const wallet = walletAvailable(rent)
  const settled = bal.remaining <= 0
  const ul = rent.party === 'ul'

  const accept = (method: MethodKind, sum = amount, cb: string | null = cashboxFor(method, rent)) => {
    setBusy(true)
    window.setTimeout(() => {
      dispatch({ type: 'ACCEPT', method, cashboxId: method === 'cash' ? cashbox : cb, amount: sum })
      setBusy(false)
    }, 180)
  }

  const confirmPending = () => {
    const d = pending[0]
    setBusy(true)
    window.setTimeout(() => {
      dispatch({ type: 'ACCEPT', draftId: d.id, method: 'bank', cashboxId: d.cashboxId, amount: d.amount, target: d.target, invoiceId: d.invoiceId })
      setBusy(false)
    }, 180)
  }

  const parts = [
    bal.rent.remaining > 0 && `оренда ${formatAmount(bal.rent.remaining)}`,
    bal.chargesRemaining > 0 && `нарахування ${formatAmount(bal.chargesRemaining)}`,
    bal.deposit.remaining > 0 && `застава ${formatAmount(bal.deposit.remaining)}`,
  ].filter(Boolean)

  if (settled)
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-3" data-testid="quick-actions">
        <p className="text-body text-fg-2" data-remaining={railOwnsRemaining ? undefined : 'sentence'}>
          Усе прийнято{bal.overpay > 0 ? `. Переплата ${formatMoney(bal.overpay)} — до повернення клієнту.` : '.'}
        </p>
      </div>
    )

  // Головна дія: юрособа з рахунком, що чекає, — підтвердження; фізособа — готівка.
  const primary =
    pending.length > 0 && free === 0
      ? { label: `Підтвердити переказ ${formatMoney(pending[0].amount)}`, run: confirmPending, testId: 'quick-confirm' }
      : ul
        ? { label: `Переказом ${formatMoney(amount)}`, run: () => setBankOpen(true), testId: 'quick-bank' }
        : { label: `Готівкою ${formatMoney(amount)}`, run: () => accept('cash'), testId: 'quick-cash' }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-card px-3 py-3" data-testid="quick-actions">
      {!railOwnsRemaining && (
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-body text-fg-2" data-remaining="sentence">
          <span>Прийняти</span>
          {editing ? (
            <AmountInput
              value={amount}
              onDone={(v) => {
                setEditing(false)
                if (v != null) setCustom(v)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-sm border-b border-dashed border-fg-2 text-headline font-semibold tabular-nums text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
              data-testid="sentence-amount"
              title="Змінити суму"
            >
              {formatAmount(amount)}
            </button>
          )}
          <span>грн{amount < free ? ` з ${formatAmount(free)}` : ''}:</span>
          <span className="text-muted-fg">{parts.join(' і ')}</span>
        </p>
      )}
      {pending.length > 0 && free > 0 && (
        <ul className="flex flex-col gap-1.5">
          {pending.map((d) => {
            const inv = rent.invoices.find((i) => i.id === d.invoiceId)
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent-soft/40 px-2.5 py-1.5 text-body">
                <span className="min-w-0 flex-1">
                  Чекаємо переказ {d.target === 'deposit' ? 'застави' : 'оренди'} <span className="tabular-nums">{formatMoney(d.amount)}</span>
                  <span className="block text-label text-muted-fg">
                    Рахунок на оплату {inv?.number ?? '№ очікується від 1С'} від {inv?.createdAt}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    window.setTimeout(() => {
                      dispatch({ type: 'ACCEPT', draftId: d.id, method: 'bank', cashboxId: d.cashboxId, amount: d.amount, target: d.target, invoiceId: d.invoiceId })
                      setBusy(false)
                    }, 180)
                  }}
                  data-testid={`confirm-${d.id}`}
                >
                  Підтвердити за квитанцією
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-stretch">
          <Button
            onClick={primary.run}
            disabled={busy || (primary.testId !== 'quick-confirm' && amount <= 0)}
            className={cn(!ul && pending.length === 0 && 'rounded-r-none')}
            data-testid={primary.testId}
            data-main-action="intake"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {primary.label}
          </Button>
          {!ul && pending.length === 0 && (
            <div className="[&_button]:h-[30px] [&_button]:rounded-l-none [&_button]:border-l-0">
              <CashboxChip method="cash" value={cashbox} onChange={setCashbox} testId="cashbox-chip" />
            </div>
          )}
        </div>
        {!ul && (
          <Button variant="secondary" onClick={() => accept('terminal')} disabled={busy || amount <= 0} data-testid="quick-terminal">
            Терміналом
          </Button>
        )}
        {ul ? (
          <Button variant="secondary" onClick={() => accept('cash')} disabled={busy || amount <= 0} data-testid="quick-cash">
            Готівкою у ФОП
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setBankOpen(true)} disabled={amount <= 0} data-testid="quick-bank">
            <Landmark className="size-3.5" aria-hidden />
            Переказом
          </Button>
        )}
        {wallet > 0 && (
          <Button variant="secondary" onClick={() => accept('balance', Math.min(wallet, amount), null)} disabled={busy} data-testid="quick-balance">
            З балансу {formatAmount(Math.min(wallet, amount))}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setSplit((v) => !v)} aria-pressed={split} data-testid="quick-split" className="ml-auto">
          <Split className="size-3.5" aria-hidden />
          Розділити
        </Button>
      </div>
      {split && <SplitEditor bal={bal} onDone={() => setSplit(false)} />}
      {bankOpen && <BankSheet amount={amount} onClose={() => setBankOpen(false)} />}
    </div>
  )
}

function AmountInput({ value, onDone }: { value: number; onDone: (v: number | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const commit = () => {
    const v = Number(ref.current?.value.replace(/\s/g, '').replace(',', '.')) || 0
    onDone(v > 0 ? v : null)
  }
  return (
    <input
      ref={ref}
      defaultValue={formatAmount(value)}
      inputMode="decimal"
      aria-label="Сума до прийому"
      data-testid="sentence-input"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onDone(null)
      }}
      className="h-7 w-24 rounded-md border border-fg/50 bg-card px-1.5 text-right text-headline font-semibold tabular-nums outline-none"
    />
  )
}

/* ── «Розділити…»: кілька платежів з одного ─────────────────────────── */

function SplitEditor({ bal, onDone }: { bal: Balance; onDone: () => void }) {
  const { rent, dispatch } = useStore()
  const groups = [
    { key: 'rent' as const, label: 'Оренда', amount: bal.rent.remaining },
    { key: 'charges' as const, label: 'Нарахування', amount: bal.chargesRemaining },
    { key: 'deposit' as const, label: 'Застава', amount: bal.deposit.remaining },
  ].filter((g) => g.amount > 0)
  const [methods, setMethods] = useState<Record<string, MethodKind>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, rent.party === 'ul' ? 'bank' : 'cash'])),
  )
  const [busy, setBusy] = useState(false)
  const run = () => {
    setBusy(true)
    window.setTimeout(() => {
      // Групи з однаковим способом зливаються в один платіж: один ПКО на касу.
      const byMethod = new Map<MethodKind, { amount: number; items: ItemKey[] }>()
      for (const g of groups) {
        const m = methods[g.key]
        const items = g.key === 'rent' ? ['rent'] : g.key === 'deposit' ? ['deposit'] : itemsOfTarget('charges', bal)!
        const cur = byMethod.get(m) ?? { amount: 0, items: [] }
        byMethod.set(m, { amount: cur.amount + g.amount, items: [...cur.items, ...items] })
      }
      for (const [m, v] of byMethod) {
        dispatch({ type: 'ACCEPT', method: m, cashboxId: cashboxFor(m, rent), amount: Math.min(v.amount, roomOf(bal, v.items)), items: v.items })
      }
      setBusy(false)
      onDone()
    }, 180)
  }
  const count = new Set(Object.values(methods)).size
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5" data-testid="split-editor">
      <ul className="flex flex-col gap-1.5">
        {groups.map((g) => (
          <li key={g.key} className="flex flex-wrap items-center gap-2">
            <span className="w-28 text-body">{g.label}</span>
            <span className="w-20 text-right text-body tabular-nums">{formatAmount(g.amount)}</span>
            <MethodPicker
              value={methods[g.key]}
              methods={rent.party === 'ul' ? ['bank', 'cash'] : ['cash', 'terminal', 'bank']}
              onChange={(m) => setMethods((cur) => ({ ...cur, [g.key]: m }))}
              size="sm"
              testId={`split-${g.key}`}
            />
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Не ділити
        </Button>
        <Button variant="secondary" size="sm" onClick={run} disabled={busy} data-testid="split-accept">
          Прийняти {count} {count === 1 ? 'платіж' : 'платежі'}
        </Button>
      </div>
    </div>
  )
}

/* ── Переказ: бокова панель ─────────────────────────────────────────── */

/**
 * Реквізити, QR і рахунок на оплату — у боковій панелі над сайдбаром.
 * Сторінка під нею не рухається. Головна дія панелі — «Підтвердити за
 * квитанцією»; рахунок на оплату формується лише на прохання.
 */
function BankSheet({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { rent, dispatch } = useStore()
  const bal = balanceOf(rent)
  const [cashbox, setCashbox] = useState<string | null>(() => cashboxFor('bank', rent))
  const box = cashboxOf(cashbox)
  const ul = rent.party === 'ul'
  const invoices = rent.drafts.filter((d) => d.invoiceId).map((d) => rent.invoices.find((i) => i.id === d.invoiceId)!)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const issue = () => {
    if (ul) {
      const rentAmt = bal.rentAccount.remaining
      if (rentAmt > 0) dispatch({ type: 'BANK_REQUEST', target: 'rent', group: 'rent', amount: rentAmt, cashboxId: cashbox })
      if (bal.deposit.remaining > 0) dispatch({ type: 'BANK_REQUEST', target: 'deposit', group: 'deposit', amount: bal.deposit.remaining, cashboxId: cashbox })
    } else {
      dispatch({ type: 'BANK_REQUEST', target: 'auto', group: 'all', amount, cashboxId: cashbox })
    }
  }

  const confirm = () => {
    const pendings = rent.drafts.filter((d) => d.invoiceId)
    if (pendings.length) {
      const d = pendings[0]
      dispatch({ type: 'ACCEPT', draftId: d.id, method: 'bank', cashboxId: d.cashboxId, amount: d.amount, target: d.target, invoiceId: d.invoiceId })
    } else {
      dispatch({ type: 'ACCEPT', method: 'bank', cashboxId: cashbox, amount })
    }
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="bank-sheet">
      <button type="button" aria-label="Закрити" className="absolute inset-0 bg-fg/10" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Банківський переказ" className="relative flex h-full w-[26rem] max-w-full flex-col border-l border-border bg-card shadow-dialog animate-in slide-in-from-right-4 fade-in-0 duration-200 motion-reduce:animate-none">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Landmark className="size-4 text-muted-fg" aria-hidden />
          <h2 className="text-title font-semibold">{METHOD_META.bank.label}</h2>
          <span className="ml-auto text-headline font-semibold tabular-nums">{formatMoney(amount)}</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрити">
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-label text-muted-fg">Одержувач</span>
            <CashboxChip method="bank" value={cashbox} onChange={setCashbox} />
          </div>
          {box && <Requisites box={box} amount={amount} purpose={purposeOf(rent)} />}
          {invoices.length > 0 ? (
            invoices.map((inv) => <InvoiceLine key={inv.id} invoice={inv} amount={inv.amount} />)
          ) : (
            <InvoiceLine onIssue={issue} amount={amount} />
          )}
          {ul && invoices.length === 0 && (
            <p className="text-label text-muted-fg">Юрособі — два рахунки: оренда з ПДВ і застава без ПДВ.</p>
          )}
        </div>
        <footer className="border-t border-border px-4 py-3">
          <Button className="w-full" size="lg" onClick={confirm} data-testid="bank-confirm">
            Підтвердити за квитанцією
          </Button>
          <p className="mt-1.5 text-center text-label text-muted-fg">Натисніть, коли клієнт покаже квитанцію про оплату.</p>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}
