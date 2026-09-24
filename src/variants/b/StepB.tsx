import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, HandCoins, Loader2, PackageCheck, Plus, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { balanceOf, itemsOfTarget, roomOf, walletAvailable, type ItemKey } from '@/domain/money'
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
  defaultMethod,
  MethodDetails,
  MethodPicker,
  methodsFor,
  PaymentsLedger,
} from '@/features/rent/shared/intake-kit'
import { RegistryLine } from '@/variants/a/StepA'
import type { Charge, MethodKind } from '@/mock/types'

/**
 * Варіант B — «Список до сплати».
 *
 * Гіпотеза продакта в найсильнішій формі (в): список позицій і нарахувань
 * І Є складом платежу. Галочки стоять на підсумках «Оренда» і «Застава» і
 * на кожному нарахуванні. Ліва половина «Оплачуємо зараз», смуги і картки
 * зникають: їхню роботу робить список.
 *
 * Під списком — один рядок прийому: спосіб (фізособі підставлено готівку),
 * каса, сума відміченого, головна дія. Сцена 1 — один клік.
 *
 * «Скільки ще прийняти» друкує рівно одне місце: підсумковий рядок списку.
 */
export function StepB() {
  const { rent } = useStore()
  const { chargeForm, closeChargeForm, openChargeForm, railOwnsRemaining } = useCard()
  const bal = balanceOf(rent)
  const [cancelling, setCancelling] = useState<Charge | null>(null)
  const live = rent.payments.filter((p) => !p.annulled)

  // Вибір — локальний стан прийому: після кожного платежу знову «усе, що лишилось».
  const allKeys = useMemo<ItemKey[]>(
    () => ['rent', ...bal.charges.filter((c) => !c.charge.cancelled && c.remaining > 0).map((c) => c.charge.id), 'deposit'],
    [bal.charges],
  )
  const [selection, setSelection] = useState<ItemKey[] | null>(null)
  const selected = selection ?? allKeys
  const toggle = (key: ItemKey, on: boolean) =>
    setSelection((cur) => {
      const base = cur ?? allKeys
      return on ? [...new Set([...base, key])] : base.filter((k) => k !== key)
    })
  useEffect(() => setSelection(null), [live.length])

  const pending = rent.drafts.filter((d) => d.method === 'bank' && d.invoiceId)

  return (
    <StageRail testId="payment-stage">
      <StageRail.Step
        key="list"
        tone={bal.remaining > 0 ? 'ready' : 'done'}
        icon={ReceiptText}
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
          <PositionsList
            rent={rent}
            bal={bal}
            mode="compose"
            selection={selected}
            onToggle={toggle}
            editable={live.length === 0}
            onCancelCharge={setCancelling}
            remainingSlot={
              !railOwnsRemaining && (
                <div className="flex items-baseline justify-between gap-3 border-t border-border bg-muted/30 px-3 py-2" data-remaining="list-total">
                  <span className="text-body font-medium">{bal.remaining > 0 ? 'Лишилось прийняти' : 'Прийнято все'}</span>
                  <span className="text-headline font-semibold tabular-nums">{formatMoney(bal.remaining)}</span>
                </div>
              )
            }
          />
          <CancelChargeDialog charge={cancelling} onClose={() => setCancelling(null)} />
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
          {pending.map((d) => (
            <PendingTransfer key={d.id} draftId={d.id} />
          ))}
          {bal.remaining - pending.reduce((s, d) => s + d.amount, 0) > 0 && <IntakeLine selected={selected} />}
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

/** Рядок прийому під списком: спосіб, каса, сума відміченого, дія. */
function IntakeLine({ selected }: { selected: ItemKey[] }) {
  const { rent, dispatch } = useStore()
  const bal = balanceOf(rent)
  const [method, setMethod] = useState<MethodKind>(defaultMethod(rent.party))
  const [cashbox, setCashbox] = useState<string | null>(() => cashboxFor(defaultMethod(rent.party), rent))
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Сформовані рахунки на оплату вже чекають своїх грошей: їх не приймаємо вдруге.
  const reserved = rent.drafts.filter((d) => d.invoiceId).reduce((s, d) => s + d.amount, 0)
  const room = Math.max(0, roomOf(bal, selected) - reserved)
  const cap = method === 'balance' ? walletAvailable(rent) : Infinity
  const amount = text != null ? Number(text.replace(/\s/g, '').replace(',', '.')) || 0 : Math.min(room, cap)
  const over = amount > room
  const blocked = selected.length === 0 ? 'Відмітьте, що оплачує клієнт' : amount <= 0 ? 'Вкажіть суму' : over ? 'Більше, ніж відмічено' : amount > cap ? 'На гаманці менше' : null

  useEffect(() => setText(null), [room])
  // Після кожного платежу — знову спосіб за замовчуванням: гаманець міг спорожніти.
  const paidCount = rent.payments.length
  useEffect(() => {
    setMethod(defaultMethod(rent.party))
    setCashbox(cashboxFor(defaultMethod(rent.party), rent))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidCount])

  const pick = (m: MethodKind) => {
    setMethod(m)
    setCashbox(cashboxFor(m, rent))
    setText(null)
  }

  const accept = () => {
    setBusy(true)
    window.setTimeout(() => {
      dispatch({ type: 'ACCEPT', method, cashboxId: cashbox, amount, items: selected })
      setBusy(false)
      setText(null)
    }, 180)
  }

  const issueInvoice = () => {
    // Юрособа: оренда з ПДВ і застава без ПДВ — два рахунки на оплату.
    // Фізособа: один рахунок на всю відмічену суму (§5).
    if (rent.party === 'ul') {
      const rentKeys = itemsOfTarget('rent', bal)!.filter((k) => selected.includes(k))
      const rentAmt = roomOf(bal, rentKeys)
      if (rentAmt > 0) dispatch({ type: 'BANK_REQUEST', target: 'rent', group: 'rent', amount: rentAmt, cashboxId: cashbox })
      if (selected.includes('deposit') && bal.deposit.remaining > 0)
        dispatch({ type: 'BANK_REQUEST', target: 'deposit', group: 'deposit', amount: bal.deposit.remaining, cashboxId: cashbox })
      return
    }
    dispatch({ type: 'BANK_REQUEST', target: 'auto', group: 'all', amount, cashboxId: cashbox })
  }

  const label = method === 'bank' ? 'Підтвердити' : method === 'balance' ? 'Списати' : 'Прийняти'

  return (
    <section className="rounded-lg border border-border-strong bg-card" data-testid="intake-line">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <MethodPicker
          value={method}
          methods={methodsFor(rent.party, rent.counterparty.wallet)}
          wallet={walletAvailable(rent) || undefined}
          onChange={pick}
          size="sm"
        />
        <div className="min-w-0 max-w-[13rem]">
          <CashboxChip method={method} value={cashbox} onChange={setCashbox} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-28">
            <input
              inputMode="decimal"
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Сума платежу"
              value={text ?? formatAmount(amount)}
              onChange={(e) => setText(e.target.value.replace(/[^\d\s,.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              data-testid="amount"
              className={cn(
                'h-8 w-full rounded-md border border-border-strong bg-card pl-2 pr-5 text-right text-body font-medium tabular-nums outline-none focus:border-fg/50',
                over && 'text-danger-fg',
              )}
            />
            <span className="pointer-events-none absolute inset-y-0 right-1.5 grid place-items-center text-body text-muted-fg">₴</span>
          </div>
          <Button
            onClick={accept}
            disabled={!!blocked || busy}
            className="min-w-[11.5rem]"
            data-testid="accept"
            data-main-action="intake"
            title={blocked ?? undefined}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {label} {formatMoney(amount)}
          </Button>
        </div>
      </div>
      <p className="border-t border-border px-3 py-1.5 text-label text-muted-fg" aria-live="polite">
        {blocked ??
          (amount < room ? (
            <span data-remaining="after">Частина: після прийому лишиться {formatMoney(room - amount)} за відміченим.</span>
          ) : (
            'Закриває все відмічене у списку вище.'
          ))}
      </p>
      {method !== 'cash' && (
        <div className="border-t border-border bg-muted/20 px-3 py-2.5">
          <MethodDetails
            method={method}
            cashboxId={cashbox}
            amount={amount}
            target={selected.includes('rent') ? 'rent' : 'deposit'}
            onIssueInvoice={method === 'bank' ? issueInvoice : undefined}
          />
        </div>
      )}
    </section>
  )
}

/**
 * Сформований рахунок на оплату, що чекає грошей. Менеджер повертається до
 * оренди і бачить його першим — з дією «Підтвердити за квитанцією».
 */
function PendingTransfer({ draftId }: { draftId: string }) {
  const { rent, dispatch } = useStore()
  const d = rent.drafts.find((x) => x.id === draftId)!
  const inv = rent.invoices.find((i) => i.id === d.invoiceId)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft/40 px-3 py-2.5" data-testid="pending-transfer">
      <span className="min-w-0 flex-1 text-body">
        <span className="font-medium">Чекаємо переказ</span> — {d.target === 'deposit' ? 'застава' : 'оренда'}{' '}
        <span className="tabular-nums">{formatMoney(d.amount)}</span>
        <span className="block text-label text-muted-fg">
          Рахунок на оплату {inv?.number ?? '№ очікується від 1С'} від {inv?.createdAt}
        </span>
      </span>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          window.setTimeout(() => {
            dispatch({ type: 'ACCEPT', draftId: d.id, method: 'bank', cashboxId: d.cashboxId, amount: d.amount, target: d.target, invoiceId: d.invoiceId })
          }, 180)
        }}
        data-testid={`confirm-${d.id}`}
        data-main-action={rent.drafts.filter((x) => x.invoiceId)[0]?.id === d.id ? 'intake' : undefined}
      >
        Підтвердити за квитанцією
      </Button>
    </div>
  )
}
