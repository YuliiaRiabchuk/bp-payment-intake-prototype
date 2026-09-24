import { useEffect, useState } from 'react'
import { ClipboardList, HandCoins, Loader2, PackageCheck, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { balanceOf, itemsOfTarget, roomOf, walletAvailable, type Balance, type ItemKey } from '@/domain/money'
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
  defaultMethod,
  MethodDetails,
  MethodPicker,
  methodsFor,
  PaymentsLedger,
} from '@/features/rent/shared/intake-kit'
import { RegistryLine } from '@/variants/a/StepA'
import type { Charge, MethodKind } from '@/mock/types'

/**
 * Варіант C — «Касове вікно».
 *
 * Крок — дві колонки: ліворуч ЩО оплачуємо (один список (б): позиції,
 * нарахування, знижки, підсумки груп окремо), праворуч ЧИМ — панель каси
 * фіксованої висоти. Деталі способу (реквізити, QR, рахунок на оплату) живуть
 * у слоті цієї панелі й не міняють висоту сторінки. Головна дія — низ панелі,
 * завжди в тій самій точці.
 *
 * «Скільки ще прийняти» друкує один заголовок панелі.
 */

type Preset = 'all' | 'rent' | 'deposit' | 'charges'

export function StepC() {
  const { rent } = useStore()
  const { chargeForm, closeChargeForm, openChargeForm } = useCard()
  const bal = balanceOf(rent)
  const [cancelling, setCancelling] = useState<Charge | null>(null)
  const live = rent.payments.filter((p) => !p.annulled)

  return (
    <StageRail testId="payment-stage">
      <StageRail.Step
        key="intake"
        tone={bal.remaining <= 0 ? 'done' : live.length ? 'partial' : 'current'}
        icon={HandCoins}
        label="Прийом коштів"
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
        testId="step-intake"
      >
        <div className="flex flex-col gap-3" data-step="intake">
          {chargeForm && <ChargeForm kind={chargeForm} onDone={closeChargeForm} onCancel={closeChargeForm} />}
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <section aria-label="Що оплачуємо" className="min-w-0">
              <PositionsList rent={rent} bal={bal} mode="merged" editable={live.length === 0} onCancelCharge={setCancelling} />
            </section>
            <CashPanel />
          </div>
          <PaymentsLedger rent={rent} />
          <CancelChargeDialog charge={cancelling} onClose={() => setCancelling(null)} />
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

function presetItems(p: Preset, bal: Balance): ItemKey[] | undefined {
  if (p === 'all') return undefined
  if (p === 'rent') return ['rent']
  if (p === 'deposit') return ['deposit']
  return bal.charges.map((c) => c.charge.id)
}

/** Панель каси. Висота фіксована: вибір способу чи пресета її не змінює. */
function CashPanel() {
  const { rent, dispatch } = useStore()
  const { railOwnsRemaining } = useCard()
  const bal = balanceOf(rent)
  const pending = rent.drafts.filter((d) => d.method === 'bank' && d.invoiceId)
  const reserved = pending.reduce((s, d) => s + d.amount, 0)

  const [method, setMethod] = useState<MethodKind>(defaultMethod(rent.party))
  const [cashbox, setCashbox] = useState<string | null>(() => cashboxFor(defaultMethod(rent.party), rent))
  const [preset, setPreset] = useState<Preset>('all')
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const paidCount = rent.payments.length

  // Після кожного платежу панель повертається до «усе, що лишилось».
  useEffect(() => {
    setPreset('all')
    setText(null)
    setMethod(defaultMethod(rent.party))
    setCashbox(cashboxFor(defaultMethod(rent.party), rent))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidCount])

  const items = presetItems(preset, bal)
  const room = Math.max(0, roomOf(bal, items) - (preset === 'all' ? reserved : 0))
  const cap = method === 'balance' ? walletAvailable(rent) : Infinity
  const amount = text != null ? Number(text.replace(/\s/g, '').replace(',', '.')) || 0 : Math.min(room, cap)
  const over = amount > room
  const settled = bal.remaining <= 0
  const confirmPending = method === 'bank' && pending.length > 0
  const first = pending[0]
  const blocked = settled
    ? 'Приймати нічого'
    : confirmPending
      ? null
      : amount <= 0
        ? 'Вкажіть суму'
        : over
          ? 'Більше, ніж лишилось'
          : amount > cap
            ? 'На гаманці менше'
            : null

  const presets: { value: Preset; label: string; room: number }[] = [
    { value: 'all' as const, label: 'Усе', room: bal.remaining },
    { value: 'rent' as const, label: 'Оренда', room: bal.rent.remaining },
    { value: 'deposit' as const, label: 'Застава', room: bal.deposit.remaining },
    { value: 'charges' as const, label: 'Нарахування', room: bal.chargesRemaining },
  ].filter((p) => p.value === 'all' || p.room > 0)

  const pick = (m: MethodKind) => {
    setMethod(m)
    setCashbox(cashboxFor(m, rent))
    setText(null)
  }

  const accept = () => {
    setBusy(true)
    window.setTimeout(() => {
      if (confirmPending && first) {
        dispatch({ type: 'ACCEPT', draftId: first.id, method: 'bank', cashboxId: first.cashboxId, amount: first.amount, target: first.target, invoiceId: first.invoiceId })
      } else {
        dispatch({ type: 'ACCEPT', method, cashboxId: cashbox, amount, items })
      }
      setBusy(false)
      setText(null)
    }, 180)
  }

  const issueInvoice = () => {
    if (rent.party === 'ul') {
      const rentKeys = itemsOfTarget('rent', bal)!.filter((k) => !items || items.includes(k))
      const rentAmt = roomOf(bal, rentKeys)
      if (rentAmt > 0 && preset !== 'deposit') dispatch({ type: 'BANK_REQUEST', target: 'rent', group: 'rent', amount: rentAmt, cashboxId: cashbox })
      if (bal.deposit.remaining > 0 && (preset === 'all' || preset === 'deposit'))
        dispatch({ type: 'BANK_REQUEST', target: 'deposit', group: 'deposit', amount: bal.deposit.remaining, cashboxId: cashbox })
      return
    }
    dispatch({ type: 'BANK_REQUEST', target: 'auto', group: 'all', amount, cashboxId: cashbox })
  }

  const label = confirmPending
    ? `Підтвердити ${formatMoney(first!.amount)}`
    : method === 'bank'
      ? `Підтвердити ${formatMoney(amount)}`
      : method === 'balance'
        ? `Списати ${formatMoney(amount)}`
        : `Прийняти ${formatMoney(amount)}`

  return (
    <section
      aria-label="Каса"
      className="flex h-[27rem] flex-col rounded-lg border border-border-strong bg-card lg:sticky lg:top-3"
      data-testid="cash-panel"
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2.5">
        <span className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">Каса</span>
        {!railOwnsRemaining && (
          <span className="flex items-baseline gap-2" data-remaining="panel">
            <span className="text-label text-muted-fg">{settled ? 'Прийнято все' : 'До прийому'}</span>
            <span className="text-headline font-semibold tabular-nums">{formatMoney(bal.remaining)}</span>
          </span>
        )}
      </header>
      <div className="flex flex-col gap-2.5 px-3 pt-3">
        <MethodPicker
          value={method}
          methods={methodsFor(rent.party, rent.counterparty.wallet)}
          wallet={walletAvailable(rent) || undefined}
          onChange={pick}
          size="sm"
        />
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-label text-muted-fg">{method === 'bank' ? 'Одержувач' : 'Каса'}</span>
          <div className="min-w-0 flex-1">
            <CashboxChip method={method} value={cashbox} onChange={setCashbox} align="end" />
          </div>
        </div>
        {presets.length > 1 && !confirmPending && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-label text-muted-fg">Оплачує</span>
            <SegmentedControl
              size="sm"
              value={preset}
              onChange={(p) => {
                setPreset(p)
                setText(null)
              }}
              options={presets.map((p) => ({ value: p.value, label: p.label, testId: `preset-${p.value}` }))}
            />
          </div>
        )}
        {!confirmPending && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-label text-muted-fg">Сума</span>
            <div className="relative flex-1">
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
          </div>
        )}
      </div>
      <div className="mx-3 mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border pt-2.5" data-testid="method-slot">
        {confirmPending && first ? (
          <div className="flex flex-col gap-1.5 text-body">
            <p className="font-medium">Чекаємо переказ</p>
            {pending.map((d) => {
              const inv = rent.invoices.find((i) => i.id === d.invoiceId)
              return (
                <p key={d.id} className="text-label text-muted-fg">
                  {d.target === 'deposit' ? 'Застава' : 'Оренда'} {formatMoney(d.amount)} — рахунок {inv?.number ?? '№ очікується від 1С'}, {inv?.createdAt}
                  <span className="block">{cashboxOf(d.cashboxId)?.org}</span>
                </p>
              )
            })}
            <p className="text-label text-fg-2">Підтвердіть, коли клієнт покаже квитанцію.</p>
          </div>
        ) : settled ? (
          <p className="text-label text-muted-fg">Усе прийнято. Далі — видача.</p>
        ) : (
          <MethodDetails
            method={method}
            cashboxId={cashbox}
            amount={amount}
            target={preset === 'deposit' ? 'deposit' : 'rent'}
            onIssueInvoice={method === 'bank' ? issueInvoice : undefined}
            compact
          />
        )}
      </div>
      <footer className="border-t border-border p-3">
        <Button
          className="w-full"
          size="lg"
          disabled={!!blocked || busy}
          onClick={accept}
          data-testid="accept"
          data-main-action="intake"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {settled ? 'Прийнято все' : label}
        </Button>
        <p className="mt-1.5 min-h-4 text-center text-label text-muted-fg" aria-live="polite">
          {blocked && !settled ? (
            blocked
          ) : amount < room ? (
            <span data-remaining="after">Після прийому лишиться {formatMoney(room - amount)}</span>
          ) : (
            ' '
          )}
        </p>
      </footer>
    </section>
  )
}
