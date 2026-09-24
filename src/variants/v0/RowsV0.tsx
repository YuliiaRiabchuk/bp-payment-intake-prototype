import { useState, type ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock,
  FilePlus2,
  FileText,
  Download,
  ListChecks,
  ListRestart,
  Loader2,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
  WalletCards,
  Zap,
  ArrowRight,

} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Reveal } from '@/components/ui/reveal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { cashboxOf, shortIban } from '@/mock/cashboxes'
import {
  coverCharges,
  factOf,
  lineNet,
  vatOfCover,
  walletAvailable,
  type Balance,
} from '@/domain/money'
import { useStore } from '@/state/store'
import { METHOD_META, MethodTile } from '@/features/rent/method-meta'
import { Requisites, purposeOf } from '@/features/rent/shared/Requisites'
import { annulBlockReason } from '@/features/rent/shared/Chronology'
import { SetupPopoverV0 } from './SetupPopoverV0'
import { AmountEditorV0, type Preset } from './AmountEditorV0'
import type { Cover, Draft, Payment, Rent } from '@/mock/types'

/* ── Оправа таблиці (порт `MethodTable` CRM) ─────────────────────────── */

const MASTER_ROW = 'h-12.5'

function cell(expanded: boolean, pos: 'first' | 'mid' | 'last') {
  return cn(
    'py-1.5 align-middle transition-colors group-hover/row:bg-muted/40',
    pos === 'first' && cn('border-l-2 pl-1.5 pr-2', expanded ? 'border-l-accent' : 'border-l-transparent'),
    pos !== 'first' && 'pr-2',
  )
}

export function MethodTableV0({ children, vat }: { children: ReactNode; vat?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" data-testid="payment-methods">
      <table
        className={cn(
          'w-full table-fixed border-separate border-spacing-0',
          '[&>tbody[data-row]+tbody[data-row]>tr:first-child>td]:border-t',
          '[&>tbody[data-row]+tbody[data-row]>tr:first-child>td]:border-t-border',
        )}
      >
        <colgroup>
          <col />
          <col className="w-36 lg:w-40" />
          <col className="w-36 lg:w-44" />
          <col className="w-28" />
          {vat && <col className="w-20" />}
          <col className="w-9" />
        </colgroup>
        <thead>
          <tr className="bg-muted/30 text-mono uppercase tracking-[0.04em] text-muted-fg [&>th]:border-b [&>th]:border-border [&>th]:py-1.5 [&>th]:font-semibold">
            <th className="px-2 text-left">Спосіб</th>
            <th className="px-1.5 text-left">Рахунок</th>
            <th className="pr-2 text-left">Статус</th>
            <th className="pr-2 text-right">Сума</th>
            {vat && <th className="pr-2 text-right">у т.ч. ПДВ</th>}
            <th />
          </tr>
        </thead>
        {children}
      </table>
    </div>
  )
}

/* ── Клітинка «Рахунок»: на що підуть гроші ───────────────────────────── */

function accountsOf(rent: Rent, cover: Cover): { label: string; amount: number }[] {
  const out: { label: string; amount: number }[] = []
  if (cover.rent > 0) out.push({ label: 'Оренда', amount: cover.rent })
  if (cover.deposit > 0) out.push({ label: 'Застава', amount: cover.deposit })
  const ch = coverCharges(cover)
  if (ch > 0) out.push({ label: 'Дод. нарахування', amount: ch })
  void rent
  return out
}

function AccountCell({ rent, cover, draft, cashboxId }: { rent: Rent; cover: Cover; draft: boolean; cashboxId: string | null }) {
  const rows = accountsOf(rent, cover)
  if (rows.length === 0) return <span className="px-1.5 text-body text-muted-fg">—</span>
  const box = cashboxOf(cashboxId)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 max-w-full items-center gap-1 rounded-md px-1.5 text-left hover:bg-fg/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-medium text-fg">{rows[0].label}</span>
            {rows.length > 1 && (
              <span className="truncate text-label text-muted-fg">{rows.slice(1).map((r) => r.label).join(' · ')}</span>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" data-popover-id="account">
        <p className="mb-2 text-body font-medium">{draft ? 'Буде зараховано' : 'Зараховано'}</p>
        <dl className="flex flex-col gap-1 text-body">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2">
              <dt className="text-fg-2">{r.label}</dt>
              <dd className="tabular-nums">{formatMoney(r.amount)}</dd>
            </div>
          ))}
        </dl>
        {box && (
          <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-label">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">{draft ? 'Каса' : 'Каса / отримувач'}</dt>
              <dd className="text-right">{box.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">IBAN</dt>
              <dd className="tabular-nums">{shortIban(box.iban)}</dd>
            </div>
          </dl>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* ── Чернетка ──────────────────────────────────────────────────────── */

export function DraftRowV0({
  draft,
  bal,
  cover,
  room,
  presets,
  expanded,
  setupOpen,
  focusSignal,
  onToggle,
  onSetupOpenChange,
  onSetupDone,
  onAmount,
  onPreset,
  onAccept,
  busy,
  vat,
}: {
  draft: Draft
  bal: Balance
  cover: Cover
  room: number
  presets: Preset[]
  expanded: boolean
  setupOpen: boolean
  focusSignal: number
  onToggle: () => void
  onSetupOpenChange: (v: boolean) => void
  onSetupDone: () => void
  onAmount: (v: number) => void
  onPreset: (p: Preset) => void
  onAccept: () => void
  busy: boolean
  vat: boolean
}) {
  const { rent, dispatch } = useStore()
  const meta = draft.method ? METHOD_META[draft.method] : null
  const configured = !!draft.method && (!meta?.destLabel || !!draft.cashboxId)
  const missingDest = !!draft.method && !configured
  const box = cashboxOf(draft.cashboxId)
  const invoice = rent.invoices.find((i) => i.id === draft.invoiceId && !i.cancelled)
  const steps = stepsCount(draft)

  return (
    <tbody data-row="" data-draft={draft.id}>
      <tr
        className={cn('group/row', MASTER_ROW, configured && 'cursor-pointer')}
        onClick={(e) => {
          if (!configured) return
          const t = e.target as HTMLElement
          if (t.closest('button, input, a, [role=button]')) return
          onToggle()
        }}
      >
        <td className={cell(expanded, 'first')}>
          <SetupPopoverV0
            draft={draft}
            bal={bal}
            open={setupOpen}
            onOpenChange={onSetupOpenChange}
            onDone={onSetupDone}
            trigger={
              <button
                type="button"
                data-testid={`setup-trigger-${draft.id}`}
                data-main-action={!draft.method ? 'intake' : undefined}
                className={cn(
                  'relative flex max-w-full items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15',
                  configured
                    ? 'border-transparent hover:bg-fg/[0.06] data-[state=open]:bg-fg/[0.06]'
                    : missingDest
                      ? 'border-dashed border-danger hover:bg-fg/[0.06]'
                      : 'border-accent-soft bg-accent-soft text-accent-fg hover:bg-accent-soft-hover',
                )}
              >
                {draft.method ? (
                  <MethodTile method={draft.method} />
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center">
                    <Plus className="size-4" aria-hidden />
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className={cn('truncate text-body font-medium', draft.method && 'text-fg')}>
                      {meta ? meta.label : 'Оберіть спосіб'}
                    </span>
                    <ChevronDown className={cn('size-4 shrink-0', draft.method && 'text-muted-fg')} aria-hidden />
                  </span>
                  {configured && box && (
                    <span className="flex min-w-0 items-center gap-1.5 text-label text-muted-fg">
                      <span className="truncate">{draft.method === 'bank' ? box.org : box.name}</span>
                      {draft.method === 'bank' && <span className="shrink-0 tabular-nums">{shortIban(box.iban)}</span>}
                    </span>
                  )}
                  {missingDest && <span className="truncate text-label font-medium text-danger-fg">Не вибрана каса</span>}
                </span>
              </button>
            }
          />
        </td>
        <td className={cell(expanded, 'mid')}>
          <AccountCell rent={rent} cover={cover} draft cashboxId={draft.cashboxId} />
        </td>
        <td className={cell(expanded, 'mid')}>
          {configured && (
            <span className="flex flex-col items-start gap-0.5">
              {invoice ? (
                <Badge variant="accent">
                  <Clock className="size-3" aria-hidden />
                  Очікує надходження
                </Badge>
              ) : (
                <Badge>
                  <CircleDashed className="size-3" aria-hidden />
                  Очікує прийому
                </Badge>
              )}
              {steps > 1 && <span className="truncate text-label text-muted-fg">крок 1 з {steps}</span>}
            </span>
          )}
        </td>
        <td className={cn(cell(expanded, 'mid'), 'text-right')}>
          <AmountEditorV0
            draftId={draft.id}
            value={draft.amount}
            room={room}
            placeholder={room}
            presets={presets}
            onCommit={onAmount}
            onPreset={onPreset}
            focusSignal={focusSignal}
            disabled={!configured}
            mainAction={configured && draft.amount === 0 && !setupOpen}
          />
        </td>
        {vat && (
          <td className={cn(cell(expanded, 'mid'), 'text-right text-label tabular-nums text-muted-fg')}>
            {draft.amount > 0 ? formatAmount(vatOfCover(rent, cover, bal.rate)) : ''}
          </td>
        )}
        <td className={cell(expanded, 'last')}>
          {configured ? (
            <button
              type="button"
              aria-label="Показати кроки способу"
              onClick={onToggle}
              className="grid size-4 place-items-center text-muted-fg hover:text-fg"
            >
              {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Видалити спосіб"
              onClick={() => dispatch({ type: 'DRAFT_REMOVE', id: draft.id })}
              className="grid size-4 place-items-center text-subtle hover:text-danger-fg"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={vat ? 6 : 5} className="p-0">
          <Reveal open={expanded}>
            <div className="border-l-2 border-t border-l-accent border-t-border">
              <DraftDetail draft={draft} bal={bal} cover={cover} room={room} onAccept={onAccept} busy={busy} />
            </div>
          </Reveal>
        </td>
      </tr>
    </tbody>
  )
}

function stepsCount(d: Draft): number {
  if (d.method === 'balance') return 1
  const box = cashboxOf(d.cashboxId)
  if (d.method === 'bank' && box?.orgAccount) return 1
  return 2
}

/* ── Розгорнута чернетка: «Оплачуємо зараз» | «Документи та прийом» ─── */

function DraftDetail({
  draft,
  bal,
  cover,
  room,
  onAccept,
  busy,
}: {
  draft: Draft
  bal: Balance
  cover: Cover
  room: number
  onAccept: () => void
  busy: boolean
}) {
  const { rent, dispatch } = useStore()
  const [selecting, setSelecting] = useState(false)
  const selection = draft.items
  const toggleItem = (key: string, on: boolean) => {
    const current = selection ?? ['rent', 'deposit', ...bal.charges.map((c) => c.charge.id)]
    const next = on ? [...new Set([...current, key])] : current.filter((k) => k !== key)
    dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { items: next } })
  }
  const excess = draft.amount - room
  return (
    <div className="grid grid-cols-1 bg-muted/30 md:grid-cols-2">
      <section className="border-b border-border p-4 md:border-b-0 md:border-r">
        <header className="mb-3 flex items-center gap-2">
          <WalletCards className="size-4 text-muted-fg" aria-hidden />
          <h3 className="text-body font-medium">Оплачуємо зараз</h3>
          {draft.amount > 0 && draft.method !== 'balance' && (
            <span className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="min-w-36"
                aria-pressed={selecting}
                onClick={() => setSelecting((v) => !v)}
              >
                {selecting ? <Check className="size-3.5" aria-hidden /> : <SlidersHorizontal className="size-3.5" aria-hidden />}
                {selecting ? 'Готово' : 'Змінити склад'}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Автоматичний розподіл"
                title="Автоматичний розподіл"
                disabled={!draft.items}
                onClick={() => dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { items: undefined } })}
              >
                <ListRestart className="size-4" aria-hidden />
              </Button>
            </span>
          )}
        </header>
        {draft.amount <= 0 ? (
          <p className="text-body text-muted-fg">Введіть суму в рядку способу — тут з’явиться склад оплати.</p>
        ) : draft.method === 'balance' ? (
          <div className="rounded-md border border-border bg-card p-3 text-body">
            <div className="flex justify-between">
              <span>Оренда та доплати</span>
              <span className="tabular-nums">{formatMoney(cover.rent + coverCharges(cover))}</span>
            </div>
            {cover.deposit > 0 && (
              <div className="flex justify-between">
                <span>Застава</span>
                <span className="tabular-nums">{formatMoney(cover.deposit)}</span>
              </div>
            )}
            <p className="mt-2 text-label text-muted-fg">Внутрішній залік. Касовий ордер не створюється.</p>
          </div>
        ) : (
          <>
            <Composition
              rent={rent}
              bal={bal}
              cover={cover}
              selecting={selecting}
              selection={selection}
              onToggle={toggleItem}
            />
            {excess > 0 && draft.items && (
              <div className="mt-2 rounded-md border border-danger/30 bg-danger-soft/40 p-2.5 text-body text-danger-fg">
                Сумма превышает выбранный состав на {formatMoney(excess)}.
                <div className="mt-1.5 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { items: undefined } })}>
                    Распределить автоматически
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { amount: room } })}>
                    Установить {formatMoney(room)}
                  </Button>
                </div>
              </div>
            )}
            <TaxSummary rent={rent} cover={cover} rate={bal.rate} total={draft.amount} />
          </>
        )}
      </section>
      <section className="p-4">
        <header className="mb-3 flex items-center gap-2">
          <ListChecks className="size-4 text-muted-fg" aria-hidden />
          <h3 className="text-body font-medium">Документи та прийом</h3>
        </header>
        <DraftSteps draft={draft} room={room} onAccept={onAccept} busy={busy} />
        <footer className="mt-4 flex justify-end border-t border-border pt-3">
          <Button variant="ghost" size="sm" className="hover:text-danger-fg" onClick={() => dispatch({ type: 'DRAFT_REMOVE', id: draft.id })}>
            <Trash2 className="size-3.5" aria-hidden />
            Видалити спосіб
          </Button>
        </footer>
      </section>
    </div>
  )
}

function Composition({
  rent,
  bal,
  cover,
  selecting,
  selection,
  onToggle,
}: {
  rent: Rent
  bal: Balance
  cover: Cover
  selecting: boolean
  selection?: string[]
  onToggle: (key: string, on: boolean) => void
}) {
  const on = (k: string) => !selection || selection.includes(k)
  const groups: { key: string; title: string; icon: ReactNode; amount: number; due: number; items: ReactNode }[] = []
  if (bal.rent.remaining > 0 || cover.rent > 0)
    groups.push({
      key: 'rent',
      title: 'Оренда',
      icon: <Package className="size-4 text-muted-fg" aria-hidden />,
      amount: cover.rent,
      due: bal.rent.remaining,
      items: rent.positions.map((p) => (
        <ItemRow key={p.id} name={p.name} qty={p.qty} amount={Math.round(lineNet(p) * (1 + bal.rate / 100))} />
      )),
    })
  if (bal.deposit.remaining > 0 || cover.deposit > 0)
    groups.push({
      key: 'deposit',
      title: 'Застава',
      icon: <ShieldCheck className="size-4 text-muted-fg" aria-hidden />,
      amount: cover.deposit,
      due: bal.deposit.remaining,
      items: rent.positions
        .filter((p) => p.kind !== 'consumable')
        .map((p) => <ItemRow key={p.id} name={p.name} qty={p.qty} amount={p.qty * p.deposit} />),
    })
  const liveCharges = bal.charges.filter((c) => !c.charge.cancelled && (c.remaining > 0 || (cover.charges[c.charge.id] ?? 0) > 0))
  if (liveCharges.length > 0)
    groups.push({
      key: 'charges',
      title: 'Дод. нарахування',
      icon: <ReceiptText className="size-4 text-muted-fg" aria-hidden />,
      amount: coverCharges(cover),
      due: liveCharges.reduce((s, c) => s + c.remaining, 0),
      items: liveCharges.map((c) => (
        <div key={c.charge.id} className="flex items-center gap-2 px-3 py-2">
          {selecting && (
            <Checkbox
              checked={on(c.charge.id)}
              onCheckedChange={(v) => onToggle(c.charge.id, v === true)}
              aria-label={`Включити в оплату: ${c.charge.article}`}
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body">{c.charge.article}</span>
            <span className="block text-label text-muted-fg">{c.charge.vatable && bal.rate > 0 ? `ПДВ ${bal.rate}%` : 'Без ПДВ'}</span>
          </span>
          <span className="text-body tabular-nums">{formatAmount(c.gross)} ₴</span>
        </div>
      )),
    })
  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <details key={g.key} open className="group overflow-hidden rounded-md border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/40 px-3 py-2 font-medium">
            {selecting && g.key !== 'charges' && (
              <Checkbox
                checked={on(g.key)}
                onCheckedChange={(v) => onToggle(g.key, v === true)}
                aria-label={`Включити в оплату: ${g.title}`}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {g.icon}
            <span className="text-body">{g.title}</span>
            <span className="ml-auto text-body tabular-nums">
              {g.amount < g.due ? `${formatAmount(g.amount)} з ${formatAmount(g.due)} ₴` : `${formatAmount(g.amount)} ₴`}
            </span>
            <ChevronDown className="size-3.5 text-muted-fg transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-border">{g.items}</div>
        </details>
      ))}
    </div>
  )
}

function ItemRow({ name, qty, amount }: { name: string; qty: number; amount: number }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted/50" aria-hidden>
        <Package className="size-4 text-subtle" />
      </span>
      <span className="min-w-0 flex-1 truncate text-body">{name}</span>
      {qty > 1 && <span className="text-label text-muted-fg">× {qty}</span>}
      <span className="text-body tabular-nums">{formatAmount(amount)} ₴</span>
    </div>
  )
}

function TaxSummary({ rent, cover, rate, total }: { rent: Rent; cover: Cover; rate: number; total: number }) {
  const vat = vatOfCover(rent, cover, rate)
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-label">
      <div>
        <dt className="text-muted-fg">Без ПДВ</dt>
        <dd className="tabular-nums text-fg">{formatMoney(total - vat)}</dd>
      </div>
      <div>
        <dt className="text-muted-fg">ПДВ у сумі</dt>
        <dd className="tabular-nums text-fg">{formatMoney(vat)}</dd>
      </div>
      <div className="text-right">
        <dt className="text-muted-fg">Разом</dt>
        <dd className="font-semibold tabular-nums text-fg">{formatMoney(total)}</dd>
      </div>
    </dl>
  )
}

/* ── Кроки прийому (порт `MethodSteps`) ──────────────────────────────── */

type NodeState = 'passed' | 'current' | 'upcoming' | 'optional'

function StepNode({
  n,
  state,
  title,
  meta,
  last,
  glyph,
  children,
}: {
  n?: number
  state: NodeState
  title: string
  meta?: ReactNode
  last?: boolean
  glyph?: ReactNode
  children?: ReactNode
}) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'mt-2 grid size-7 shrink-0 place-items-center rounded-full text-mono font-semibold',
            state === 'passed' && 'bg-success text-white',
            state === 'current' && 'bg-fg text-primary-fg',
            (state === 'upcoming' || state === 'optional') && 'border border-dashed border-border-strong bg-card text-muted-fg',
          )}
        >
          {state === 'passed' ? <Check className="size-3.5" aria-hidden /> : glyph ?? n}
        </span>
        {!last && (
          <span className={cn('my-1 w-px flex-1', state === 'passed' ? 'bg-success' : 'border-l border-dashed border-border-strong')} aria-hidden />
        )}
      </div>
      <div className={cn('min-w-0', !last && 'pb-5')}>
        <div
          className={cn(
            'rounded-md p-3',
            state === 'current' && 'border border-border-strong bg-card',
            (state === 'upcoming' || state === 'optional') && 'border border-dashed border-border bg-muted/30',
            state === 'passed' && 'px-0',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className={cn('text-body font-medium', state !== 'current' && state !== 'passed' && 'text-fg-2')}>{title}</span>
            {meta && <span className="shrink-0 text-label text-muted-fg">{meta}</span>}
          </div>
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </li>
  )
}

function DraftSteps({ draft, room, onAccept, busy }: { draft: Draft; room: number; onAccept: () => void; busy: boolean }) {
  const { rent, dispatch } = useStore()
  const box = cashboxOf(draft.cashboxId)
  const invoice = rent.invoices.find((i) => i.id === draft.invoiceId && !i.cancelled)
  const amount = draft.amount
  const over = amount > room
  const overCap = draft.method === 'balance' && amount > walletAvailable(rent)
  const blocked =
    amount <= 0
      ? 'Вкажіть суму'
      : overCap
        ? 'більше, ніж є на рахунку контрагента'
        : over
          ? rent.party === 'ul'
            ? 'більше, ніж лишилося за рахунком'
            : 'більше, ніж лишилося прийняти'
          : null
  const issuesPko = draft.method !== 'balance' && !box?.orgAccount
  const acceptLabel =
    draft.method === 'cash'
      ? `Прийняти ${formatMoney(amount)}`
      : draft.method === 'terminal'
        ? 'Підтвердити за чеком'
        : draft.method === 'bank'
          ? `Підтвердити ${formatMoney(amount)}`
          : `Списати ${formatMoney(amount)}`
  const acceptTitle =
    draft.method === 'cash'
      ? 'Прийняти готівку в касу'
      : draft.method === 'terminal'
        ? 'Провести за терміналом — чек'
        : draft.method === 'bank'
          ? 'Очікуємо надходження'
          : 'Списати з рахунку контрагента'

  const acceptButton = (
    <div>
      <dl className="mb-2 flex justify-between gap-2 text-body">
        <dt className="text-muted-fg">До приймання</dt>
        <dd className="tabular-nums">{formatMoney(amount)}</dd>
      </dl>
      <Button
        size="sm"
        disabled={!!blocked || busy}
        onClick={onAccept}
        data-testid={`accept-${draft.id}`}
        data-main-action="intake"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {acceptLabel}
      </Button>
      <Reveal open={!!blocked}>
        <p className={cn('mt-1.5 text-label', blocked === 'Вкажіть суму' ? 'text-muted-fg' : 'text-danger-fg')}>{blocked}</p>
      </Reveal>
    </div>
  )

  let n = 0
  return (
    <ol aria-label="Порядок приймання оплати">
      {draft.method === 'bank' && (
        <StepNode
          state={invoice ? 'passed' : 'optional'}
          title={invoice ? 'Рахунок на оплату сформовано' : 'Сформувати рахунок на оплату'}
          meta={invoice ? undefined : 'Необов’язково'}
          glyph={<FileText className="size-3.5" aria-hidden />}
        >
          {invoice ? (
            <StepDocument title="Рахунок на оплату" number={invoice.number} note="Додано в документи оренди" edit />
          ) : (
            <>
              <dl className="mb-2 flex flex-col gap-1 text-body">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-fg">До сплати</dt>
                  <dd className="tabular-nums">{formatMoney(amount)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-fg">Отримувач</dt>
                  <dd className="text-right">{box?.org}</dd>
                </div>
              </dl>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={amount <= 0}
                  onClick={() =>
                    dispatch({
                      type: 'INVOICE_ISSUE',
                      draftId: draft.id,
                      group: draft.target === 'deposit' ? 'deposit' : 'rent',
                      amount,
                    })
                  }
                  data-testid={`issue-invoice-${draft.id}`}
                >
                  <FilePlus2 className="size-3.5" aria-hidden />
                  Сформувати рахунок
                </Button>
                <span className="flex items-center gap-1 text-label text-muted-fg">
                  <ArrowRight className="size-3" aria-hidden />
                  PDF для клієнта
                </span>
              </div>
            </>
          )}
        </StepNode>
      )}
      <StepNode n={++n} state="current" title={acceptTitle} last={!issuesPko}>
        {acceptButton}
        {draft.method === 'bank' && box && (
          <Requisites
            className="mt-3"
            box={box}
            amount={amount}
            purpose={purposeOf(rent, draft.target === 'deposit' ? 'deposit' : 'rent')}
          />
        )}
      </StepNode>
      {issuesPko && (
        <StepNode
          n={++n}
          state="upcoming"
          title="Касовий ордер буде виписано"
          meta={
            <span className="flex items-center gap-1">
              <Zap className="size-3.5" aria-hidden />
              Автоматично
            </span>
          }
          last
        >
          <span className="flex items-center gap-1.5 text-label text-muted-fg">
            <ReceiptText className="size-3.5" aria-hidden />
            ПКО в документах оренди
          </span>
        </StepNode>
      )}
    </ol>
  )
}

function StepDocument({ title, number, note, edit }: { title: string; number: string | null; note: string; edit?: boolean }) {
  if (number == null)
    return (
      <p className="flex items-center gap-1.5 text-label text-muted-fg" data-testid="waiting-1c">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        Очікуємо № від 1С — друк буде доступний після присвоєння
      </p>
    )
  return (
    <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft/50 px-2.5 py-2">
      <FileText className="size-4 shrink-0 text-success-fg" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-body">
          <span className="font-semibold">{title}</span> <span className="font-mono text-mono">{number}</span>
        </span>
        <span className="block font-mono text-mono text-muted-fg">{note}</span>
      </span>
      {edit && (
        <Button size="sm" variant="ghost" className="text-success-fg">
          <Pencil className="size-3.5" aria-hidden />
          Редагувати рахунок
        </Button>
      )}
      <Button size="icon" variant="ghost" aria-label="Завантажити документ" className="text-success-fg">
        <Download className="size-3.5" />
      </Button>
    </div>
  )
}

/* ── Прийнятий платіж (порт `AcceptedRow`) ───────────────────────────── */

export function AcceptedRowV0({
  payment,
  bal,
  expanded,
  onToggle,
  vat,
}: {
  payment: Payment
  bal: Balance
  expanded: boolean
  onToggle: () => void
  vat: boolean
}) {
  const { rent, dispatch } = useStore()
  const [cancelOpen, setCancelOpen] = useState(false)
  const box = cashboxOf(payment.cashboxId)
  const meta = METHOD_META[payment.method]
  const time = payment.at.split(', ')[1] ?? payment.at
  const caption = payment.doc
    ? payment.doc.number
      ? `${payment.doc.number} — ${time}`
      : `№ очікується від 1С — ${time}`
    : time
  const block = annulBlockReason(rent, payment)
  const ruBlock = payment.source === '1c' ? 'Заведено из 1С' : block

  return (
    <tbody data-row="" data-payment={payment.id}>
      <tr className={cn('group/row cursor-pointer', MASTER_ROW)} onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        onToggle()
      }}>
        <td className={cell(expanded, 'first')}>
          <div className="flex max-w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1">
            <MethodTile method={payment.method} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-body font-medium text-fg">{meta.label}</span>
                {payment.source === '1c' && <Badge variant="outline">1С</Badge>}
              </span>
              <span className="truncate text-label text-muted-fg">
                {box ? (payment.method === 'bank' ? `${box.org} ${shortIban(box.iban)}` : box.name) : 'Баланс клієнта'}
              </span>
            </span>
          </div>
        </td>
        <td className={cell(expanded, 'mid')}>
          <AccountCell rent={rent} cover={payment.cover} draft={false} cashboxId={payment.cashboxId} />
        </td>
        <td className={cell(expanded, 'mid')}>
          <span className="flex flex-col items-start gap-0.5">
            <Badge variant="success">
              <Check className="size-3" aria-hidden />
              Підтверджено
            </Badge>
            <span className="truncate text-label text-muted-fg" data-testid={`payment-caption-${payment.id}`}>{caption}</span>
          </span>
        </td>
        <td className={cn(cell(expanded, 'mid'), 'text-right text-body font-semibold tabular-nums')}>
          {formatAmount(factOf(payment))} ₴
        </td>
        {vat && (
          <td className={cn(cell(expanded, 'mid'), 'text-right text-label tabular-nums text-muted-fg')}>
            {formatAmount(vatOfCover(rent, payment.cover, bal.rate))}
          </td>
        )}
        <td className={cell(expanded, 'last')}>
          <button type="button" aria-label="Показати кроки способу" onClick={onToggle} className="grid size-4 place-items-center text-muted-fg hover:text-fg">
            {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={vat ? 6 : 5} className="p-0">
          <Reveal open={expanded}>
            <div className="grid grid-cols-1 border-l-2 border-t border-l-accent border-t-border bg-muted/30 md:grid-cols-2">
              <section className="border-b border-border p-4 md:border-b-0 md:border-r">
                <header className="mb-3 flex items-center gap-2">
                  <WalletCards className="size-4 text-muted-fg" aria-hidden />
                  <h3 className="text-body font-medium">Зараховано</h3>
                </header>
                <dl className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-body">
                  {accountsOf(rent, payment.cover).map((r) => (
                    <div key={r.label} className="flex justify-between">
                      <dt>{r.label}</dt>
                      <dd className="tabular-nums">{formatMoney(r.amount)}</dd>
                    </div>
                  ))}
                </dl>
                <TaxSummary rent={rent} cover={payment.cover} rate={bal.rate} total={factOf(payment)} />
              </section>
              <section className="p-4">
                <header className="mb-3 flex items-center gap-2">
                  <ListChecks className="size-4 text-muted-fg" aria-hidden />
                  <h3 className="text-body font-medium">Документи та прийом</h3>
                </header>
                <ol>
                  <StepNode
                    state="passed"
                    title={
                      payment.method === 'cash'
                        ? 'Готівку прийнято в касу'
                        : payment.method === 'terminal'
                          ? 'Оплату за терміналом підтверджено'
                          : payment.method === 'bank'
                            ? 'Надходження підтверджено'
                            : 'Списано з рахунку контрагента'
                    }
                    meta={time}
                    last={!payment.doc}
                  >
                    <Tooltip2 reason={ruBlock}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!!ruBlock}
                        onClick={() => setCancelOpen(true)}
                        className="-ml-2 hover:text-danger-fg"
                      >
                        <Undo2 className="size-3.5" aria-hidden />
                        Скасувати прийом
                      </Button>
                    </Tooltip2>
                  </StepNode>
                  {payment.doc && (
                    <StepNode state={payment.doc.number ? 'passed' : 'upcoming'} title="Касовий ордер виписано" last>
                      {payment.doc.number ? (
                        <StepDocument title="Касовий ордер" number={payment.doc.number} note={box?.name ?? ''} />
                      ) : (
                        <p className="flex items-center gap-1.5 text-label text-muted-fg">
                          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                          Очікуємо № від 1С — касовий ордер зʼявиться після присвоєння номера
                        </p>
                      )}
                    </StepNode>
                  )}
                </ol>
              </section>
            </div>
          </Reveal>
        </td>
      </tr>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Скасувати прийом {formatMoney(payment.amount)} {payment.method === 'cash' ? 'готівкою' : ''}?
            </DialogTitle>
            <DialogDescription>Платіж буде скасовано: сума повернеться в борг за рахунками оренди.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Не скасовувати
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'ANNUL', paymentId: payment.id })
                setCancelOpen(false)
              }}
            >
              Скасувати прийом
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </tbody>
  )
}

function Tooltip2({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>
  return (
    <span title={reason} className="inline-flex">
      {children}
    </span>
  )
}


