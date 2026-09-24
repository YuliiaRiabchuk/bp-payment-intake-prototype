import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, FileText, Loader2, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { cashboxOf, shortIban } from '@/mock/cashboxes'
import { coverCharges, factOf, walletAvailable } from '@/domain/money'
import { useStore } from '@/state/store'
import { METHOD_META, MethodTile, MONEY_TONE_SOFT } from '../method-meta'
import { useCard } from '../card-context'
import { CashboxList, defaultCashbox } from './CashboxList'
import { Requisites, purposeOf } from './Requisites'
import type { Cover, MethodKind, Party, Payment, PaymentInvoice, Rent } from '@/mock/types'

/**
 * Спільні деталі прийому для варіантів A–D. Візуальна мова — та сама, що в
 * CRM: плитки способів, бейджі статусів, моно для номерів документів.
 * Різниця між варіантами — у тому, ДЕ ці деталі стоять, а не як виглядають.
 */

export function methodsFor(party: Party, wallet: number): MethodKind[] {
  const list: MethodKind[] = party === 'fl' ? ['cash', 'terminal', 'bank'] : ['bank', 'cash', 'terminal']
  if (party === 'fl' && wallet > 0) list.push('balance')
  return list
}

/** Спосіб за замовчуванням: фізособа біля стійки — готівка, юрособа — переказ. */
export const defaultMethod = (party: Party): MethodKind => (party === 'fl' ? 'cash' : 'bank')

export function cashboxFor(method: MethodKind, rent: Rent): string | null {
  if (method === 'balance') return null
  if (method === 'bank' && rent.party === 'fl') return 'cb-bank-1'
  return defaultCashbox(method, rent.party, rent.branch)
}

/* ── Перемикач способу ──────────────────────────────────────────────── */

/**
 * Сегментний перемикач способу прямо в рядку. `value = null` — нічого не
 * вибрано (варіант A вимагає явного вибору). Ширина сегментів фіксована:
 * вибір не зсуває сусідів.
 */
export function MethodPicker({
  value,
  methods,
  onChange,
  wallet,
  size = 'md',
  testId = 'method',
}: {
  value: MethodKind | null
  methods: MethodKind[]
  onChange: (m: MethodKind) => void
  wallet?: number
  size?: 'sm' | 'md'
  testId?: string
}) {
  return (
    <div role="radiogroup" aria-label="Спосіб оплати" className="inline-flex rounded-md bg-muted p-0.5" data-testid={`${testId}-picker`}>
      {methods.map((m) => {
        const meta = METHOD_META[m]
        const Icon = meta.icon
        const active = value === m
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            data-testid={`${testId}-${m}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg',
              size === 'md' ? 'h-7 px-2.5 text-body' : 'h-6 px-2 text-label',
              active ? 'bg-card text-fg shadow-sm ring-1 ring-black/[0.04]' : 'text-muted-fg hover:text-fg',
            )}
          >
            <Icon className={cn('size-3.5 shrink-0', active && MONEY_TONE_SOFT[meta.tone].split(' ')[1])} aria-hidden />
            {meta.short}
            {m === 'balance' && wallet != null && <span className="tabular-nums text-muted-fg">{formatAmount(wallet)}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ── Чип каси: окремий поповер, що не перебудовує вибір способу ──────── */

export function CashboxChip({
  method,
  value,
  onChange,
  testId = 'cashbox-chip',
  align = 'start',
}: {
  method: MethodKind
  value: string | null
  onChange: (id: string) => void
  testId?: string
  align?: 'start' | 'end'
}) {
  const { rent } = useStore()
  const [open, setOpen] = useState(false)
  if (method === 'balance') {
    return <span className="text-label text-muted-fg">гаманець клієнта</span>
  }
  const box = cashboxOf(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className={cn(
            'inline-flex h-7 max-w-full items-center gap-1 rounded-md border px-2 text-left text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg',
            box ? 'border-border bg-card hover:bg-muted' : 'border-dashed border-danger text-danger-fg',
          )}
        >
          <span className="truncate">{box ? (method === 'bank' ? box.org : box.name) : 'Оберіть касу'}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[380px] p-2" data-popover-id="cashbox" data-testid="cashbox-popover">
        <CashboxList
          method={method}
          party={rent.party}
          branch={rent.branch}
          value={value}
          autoFocus
          onPick={(id) => {
            onChange(id)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/* ── Що покриває платіж, словами ─────────────────────────────────────── */

export function coverWords(rent: Rent, cover: Cover): string {
  const parts: string[] = []
  if (cover.rent > 0) parts.push(`оренда ${formatAmount(cover.rent)}`)
  for (const [id, amount] of Object.entries(cover.charges)) {
    const c = rent.charges.find((x) => x.id === id)
    if (amount > 0) parts.push(`${(c?.article ?? 'нарахування').toLowerCase()} ${formatAmount(amount)}`)
  }
  if (cover.deposit > 0) parts.push(`застава ${formatAmount(cover.deposit)}`)
  return parts.join(', ')
}

export const coverSum = (c: Cover) => c.rent + c.deposit + coverCharges(c)

/* ── Документ платежу ───────────────────────────────────────────────── */

export function DocLabel({ payment }: { payment: Payment }) {
  if (payment.annulled) return <span className="font-mono text-mono text-danger-fg">{payment.doc?.number ?? '—'} анульовано</span>
  if (!payment.doc) return <span className="text-label text-muted-fg">без ПКО</span>
  if (payment.doc.number == null)
    return (
      <span className="inline-flex items-center gap-1 text-label text-muted-fg" data-testid="waiting-1c">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />№ очікується від 1С
      </span>
    )
  return <span className="font-mono text-mono text-fg-2">{payment.doc.number}</span>
}

/* ── Журнал прийнятих платежів ──────────────────────────────────────── */

/**
 * Прийняті платежі: спосіб, каса, ЩО закрив, документ, час. Скасований
 * лишається рядком, закресленим, зі сторно. Кнопок «Скасувати» тут немає:
 * сторно — з хронології (§5).
 */
export function PaymentsLedger({ rent, title = 'Прийнято', className }: { rent: Rent; title?: string; className?: string }) {
  const { openChronology } = useCard()
  const rows = rent.payments
  if (rows.length === 0) return null
  return (
    <section className={cn('rounded-lg border border-border bg-card', className)} data-testid="payments-ledger">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <h3 className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">{title}</h3>
        <button type="button" onClick={openChronology} className="text-label text-muted-fg underline-offset-2 hover:text-fg hover:underline">
          Хронологія і сторно
        </button>
      </header>
      <ul>
        {rows.map((p) => (
          <PaymentLine key={p.id} rent={rent} payment={p} />
        ))}
      </ul>
    </section>
  )
}

export function PaymentLine({ rent, payment: p }: { rent: Rent; payment: Payment }) {
  const box = cashboxOf(p.cashboxId)
  const time = p.at.split(', ')[1] ?? p.at
  const day = p.at.split(', ')[0]
  const fact = factOf(p)
  return (
    <li
      className={cn('flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0', p.annulled && 'bg-muted/30')}
      data-payment-line={p.id}
    >
      <MethodTile method={p.method} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cn('flex flex-wrap items-center gap-x-1.5 text-body', p.annulled && 'text-muted-fg line-through')}>
          <span className="font-medium text-fg">{METHOD_META[p.method].short}</span>
          <span className="text-muted-fg">— {coverWords(rent, p.cover)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-label text-muted-fg">
          <span>{box ? (p.method === 'bank' ? `${box.org} ${shortIban(box.iban)}` : box.name) : 'гаманець клієнта'}</span>
          <DocLabel payment={p} />
          {p.source === '1c' && <Badge variant="outline">1С</Badge>}
          <span className="tabular-nums">
            {day === '24.09' ? '' : `${day}, `}
            {time}
          </span>
        </span>
        {p.booked1c && !p.annulled && fact < p.amount && (
          <span className="block text-label text-danger-fg">
            1С провела {formatMoney(fact)} — недоплата {formatMoney(p.amount - fact)}
          </span>
        )}
        {p.annulled && (
          <span className="block text-label text-danger-fg">
            Сторно — {p.annulled.by}, {p.annulled.at}
          </span>
        )}
      </span>
      <span className={cn('shrink-0 text-body font-semibold tabular-nums', p.annulled && 'text-muted-fg line-through')}>
        {formatAmount(fact)}
      </span>
      {!p.annulled && <Check className="size-3.5 shrink-0 text-success-fg" aria-label="прийнято" />}
      {p.annulled && <Undo2 className="size-3.5 shrink-0 text-danger-fg" aria-label="сторно" />}
    </li>
  )
}

/* ── Деталі способу ─────────────────────────────────────────────────── */

/**
 * Що менеджер має знати про спосіб перед прийомом. Готівка й термінал —
 * одне речення; переказ — реквізити, QR і рахунок на оплату на прохання;
 * баланс — скільки на гаманці.
 */
export function MethodDetails({
  method,
  cashboxId,
  amount,
  target,
  invoice,
  onIssueInvoice,
  compact,
  proposalChek,
}: {
  method: MethodKind
  cashboxId: string | null
  amount: number
  target?: 'rent' | 'deposit' | 'auto' | 'charges'
  invoice?: PaymentInvoice
  onIssueInvoice?: () => void
  compact?: boolean
  /** Показати місце під «Пробити чек» як пропозицію (ПРРО ще не підключений). */
  proposalChek?: boolean
}) {
  const { rent } = useStore()
  const box = cashboxOf(cashboxId)
  if (method === 'cash' || method === 'terminal')
    return (
      <div className="flex flex-col gap-1.5 text-label text-muted-fg">
        <p className="flex items-start gap-1.5">
          <FileText className="mt-px size-3.5 shrink-0" aria-hidden />
          {method === 'cash'
            ? 'ПКО створиться сам, номер прийде з 1С за кілька секунд.'
            : `Проведіть оплату на терміналі${box ? ` «${box.name}»` : ''}, потім прийміть за чеком. ПКО створиться сам.`}
        </p>
        {proposalChek && (
          <p className="flex items-center gap-1.5">
            <span className="rounded-sm border border-dashed border-border-strong px-1.5 text-mono uppercase tracking-[0.04em]">пропозиція</span>
            Пробити фіскальний чек (ПРРО ще не підключений)
          </p>
        )}
      </div>
    )
  if (method === 'balance')
    return (
      <p className="text-label text-muted-fg">
        На гаманці клієнта {formatMoney(walletAvailable(rent))}. Списання закриває оренду, ПКО не створюється.
      </p>
    )
  // Переказ
  if (!box) return <p className="text-label text-danger-fg">Оберіть рахунок отримувача.</p>
  return (
    <div className="flex flex-col gap-2.5">
      <Requisites
        box={box}
        amount={amount}
        compact={compact}
        purpose={purposeOf(rent, target === 'deposit' ? 'deposit' : 'rent')}
      />
      <InvoiceLine invoice={invoice} onIssue={onIssueInvoice} amount={amount} />
    </div>
  )
}

export function InvoiceLine({
  invoice,
  onIssue,
  amount,
}: {
  invoice?: PaymentInvoice
  onIssue?: () => void
  amount: number
}): ReactNode {
  if (invoice)
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5" data-testid="invoice-doc">
        <FileText className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
        <span className="min-w-0 flex-1 text-body">
          Рахунок на оплату{' '}
          {invoice.number ? (
            <span className="font-mono text-mono">{invoice.number}</span>
          ) : (
            <span className="text-label text-muted-fg">№ очікується від 1С, друк після номера</span>
          )}
        </span>
        <span className="text-label tabular-nums text-muted-fg">{formatMoney(invoice.amount)}</span>
      </div>
    )
  if (!onIssue) return null
  return (
    <Button
      size="sm"
      variant="ghost"
      className="-ml-2 self-start text-fg-2"
      onClick={onIssue}
      disabled={amount <= 0}
      data-testid="issue-invoice"
    >
      <FileText className="size-3.5" aria-hidden />
      Сформувати рахунок на оплату — якщо клієнт просить
    </Button>
  )
}
