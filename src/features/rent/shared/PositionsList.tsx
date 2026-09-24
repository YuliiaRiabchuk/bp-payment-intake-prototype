import { useState, type ReactNode } from 'react'
import { Check, ChevronRight, Package, Pencil, Undo2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { chargeGross, gross, lineNet, type Balance, type ItemKey } from '@/domain/money'
import { ChargeIcon } from './ChargeIcon'
import type { Charge, Position, Rent } from '@/mock/types'

/**
 * Список «що йде в оренду і що нараховано зверху» — гіпотеза продакта з §6.
 *
 * Одна таблиця, три режими (варіанти брифу):
 *  - `positions` (а) — тільки номенклатура; нарахування живуть окремим блоком;
 *  - `merged` (б) — номенклатура і нарахування одним списком;
 *  - `compose` (в) — те саме з галочками: список і є складом платежу;
 *  - `charges` — тільки нарахування (окремий блок для (а) і контролю D).
 *
 * Правила, які тримає будь-який режим: підсумки оренди і застави стоять
 * окремо й не сумуються; нарахування — окрема група з власним підсумком і
 * ПДВ по рядку; знижка — мінусовий рядок; скасовані нарахування видимі в
 * окремій секції з причиною; довга назва послуги юрособи не обрізається.
 */

export type ListMode = 'positions' | 'merged' | 'compose' | 'charges'

const days = (n: number) => `${n} ${plural(n, 'доба', 'доби', 'діб')}`

export function calcLine(p: Position): string {
  if (p.kind === 'consumable') return `${p.qty} шт × ${formatMoney(p.price)}`
  return `${p.qty} × ${days(p.days ?? 1)} × ${formatMoney(p.price)}`
}

export function serviceName(rent: Rent, p: Position): string {
  if (rent.party !== 'ul') return p.name
  if (p.kind === 'consumable') return `Продаж витратного матеріалу ${p.name}`
  return `Послуга оренди ${p.name}`
}

export function PositionsList({
  rent,
  bal,
  mode,
  selection,
  onToggle,
  editable,
  onCancelCharge,
  footer,
  remainingSlot,
  className,
}: {
  rent: Rent
  bal: Balance
  mode: ListMode
  /** `compose`: вибрані ключі ('rent', 'deposit', id нарахування). */
  selection?: ItemKey[]
  onToggle?: (key: ItemKey, on: boolean) => void
  /** Склад можна правити, поки жодна оплата не пройшла. */
  editable?: boolean
  onCancelCharge?: (c: Charge) => void
  /** Рядок під таблицею (наприклад, форма нарахування). */
  footer?: ReactNode
  /** Підсумковий рядок «скільки ще» для варіанта, де список — головна поверхня. */
  remainingSlot?: ReactNode
  className?: string
}) {
  const rate = bal.rate
  const showCharges = mode !== 'positions'
  const showPositions = mode !== 'charges'
  const liveCharges = rent.charges.filter((c) => !c.cancelled)
  const cancelled = rent.charges.filter((c) => c.cancelled)
  const hasDeposit = bal.deposit.due > 0 || mode === 'charges'
  const on = (k: ItemKey) => !selection || selection.includes(k)
  const compose = mode === 'compose'
  const [openKit, setOpenKit] = useState<string | null>(null)

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)} data-testid={`positions-${mode}`}>
      <table className="w-full table-fixed border-collapse text-body">
        <colgroup>
          {compose && <col className="w-9" />}
          <col />
          <col className="w-[9.5rem]" />
          <col className="w-24" />
          {hasDeposit && <col className="w-24" />}
        </colgroup>
        {showPositions && <thead>
          <tr className="bg-muted/30 text-mono uppercase tracking-[0.04em] text-muted-fg [&>th]:border-b [&>th]:border-border [&>th]:py-1.5 [&>th]:font-semibold">
            {compose && <th />}
            <th className="px-3 text-left">{rent.party === 'ul' ? 'Послуга' : 'Обладнання'}</th>
            <th className="pr-3 text-left">Розрахунок</th>
            <th className="pr-3 text-right">Оренда</th>
            {hasDeposit && <th className="pr-3 text-right">Застава</th>}
          </tr>
        </thead>}
        {showPositions && <tbody>
          {rent.positions.map((p) => {
            const isKit = p.kind === 'kit' && p.parts?.length
            const open = openKit === p.id
            return (
              <FragmentRows key={p.id}>
                <tr className="border-b border-border align-top">
                  {compose && <td />}
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-px grid size-6 shrink-0 place-items-center rounded-md border border-border bg-muted/50" aria-hidden>
                        <Package className="size-3.5 text-subtle" />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-fg">{serviceName(rent, p)}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-label text-muted-fg">
                          <span className="font-mono text-mono">{p.sku}</span>
                          {p.kind === 'consumable' && <span>розхідник</span>}
                          {isKit && (
                            <button
                              type="button"
                              onClick={() => setOpenKit(open ? null : p.id)}
                              aria-expanded={open}
                              className="inline-flex items-center gap-0.5 rounded-sm text-fg-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
                            >
                              <ChevronRight className={cn('size-3 transition-transform duration-200', open && 'rotate-90')} aria-hidden />
                              комплект: {p.parts!.length} {plural(p.parts!.length, 'позиція', 'позиції', 'позицій')}
                            </button>
                          )}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-label tabular-nums text-muted-fg">{calcLine(p)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatAmount(gross(lineNet(p), rate))}</td>
                  {hasDeposit && (
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-2">
                      {p.kind === 'consumable' ? '—' : formatAmount(p.qty * p.deposit)}
                    </td>
                  )}
                </tr>
                {isKit && open && (
                  <tr className="border-b border-border bg-muted/20">
                    {compose && <td />}
                    <td colSpan={hasDeposit ? 4 : 3} className="py-1.5 pl-11 pr-3">
                      <ul className="flex flex-col gap-0.5 text-label text-fg-2">
                        {p.parts!.map((part) => (
                          <li key={part.name} className="flex gap-2">
                            <span className="min-w-0 flex-1">{part.name}</span>
                            <span className="tabular-nums text-muted-fg">× {part.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </FragmentRows>
            )
          })}
          <tr className="bg-muted/20 font-medium">
            {compose && <td />}
            <td className="px-3 py-1.5" colSpan={2}>
              <span className="flex items-center gap-2">
                Разом
                {rate > 0 && <span className="text-label font-normal text-muted-fg">оренда з ПДВ {rate} %</span>}
                {editable && <EditComposition />}
              </span>
            </td>
            <td className="py-1.5 pr-3 text-right tabular-nums">
              <GroupTotal
                compose={compose}
                label="Оренда"
                keyName="rent"
                total={bal.rent.gross}
                paid={bal.rent.paid}
                due={bal.rent.due}
                checked={on('rent')}
                onToggle={onToggle}
              />
            </td>
            {hasDeposit && (
              <td className="py-1.5 pr-3 text-right tabular-nums">
                <GroupTotal
                  compose={compose}
                  label="Застава"
                  keyName="deposit"
                  total={bal.deposit.due}
                  paid={bal.deposit.paid}
                  due={bal.deposit.due}
                  checked={on('deposit')}
                  onToggle={onToggle}
                />
              </td>
            )}
          </tr>
        </tbody>}
        {showCharges && (liveCharges.length > 0 || cancelled.length > 0) && (
          <tbody data-testid="charges-group">
            <tr className="bg-muted/30 text-mono uppercase tracking-[0.04em] text-muted-fg [&>td]:border-y [&>td]:border-border [&>td]:py-1.5 [&>td]:font-semibold">
              {compose && <td />}
              <td className="px-3">{mode === 'charges' ? 'Нарахування' : 'Нараховано зверху'}</td>
              <td className="pr-3">ПДВ</td>
              <td className="pr-3 text-right">Сума</td>
              {hasDeposit && <td className="pr-3 text-right">Стан</td>}
            </tr>
            {liveCharges.map((c) => {
              const cb = bal.charges.find((x) => x.charge.id === c.id)
              const discount = c.kind === 'discount'
              const amount = (discount ? -1 : 1) * chargeGross(c, rate)
              const paid = !discount && (cb?.remaining ?? 0) <= 0
              const partial = !discount && !paid && (cb?.paid ?? 0) > 0
              return (
                <tr key={c.id} className="border-b border-border align-top last:border-b-0" data-charge={c.id}>
                  {compose && (
                    <td className="py-2 pl-3">
                      {!discount && !paid && (
                        <Checkbox
                          checked={on(c.id)}
                          onCheckedChange={(v) => onToggle?.(c.id, v === true)}
                          aria-label={`Включити в платіж: ${c.article}`}
                          data-testid={`pick-${c.id}`}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-muted/60" aria-hidden>
                        <ChargeIcon article={c.article} className="size-3.5 text-muted-fg" />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-fg">{c.article}</span>
                        <span className="block text-label text-muted-fg">
                          {c.target}
                          {c.comment ? ` — ${c.comment}` : ''}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-label text-muted-fg">
                    {discount ? 'знижка' : c.vatable && rate > 0 ? `з ПДВ ${rate} %` : 'без ПДВ'}
                  </td>
                  <td className={cn('py-2 pr-3 text-right tabular-nums', discount && 'text-success-fg')}>{formatAmount(amount)}</td>
                  {hasDeposit && (
                    <td className="py-2 pr-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        {discount ? (
                          <span className="text-label text-muted-fg">зменшує оренду</span>
                        ) : paid ? (
                          <span className="inline-flex items-center gap-1 text-label text-success-fg">
                            <Check className="size-3.5" aria-hidden />
                            оплачено
                          </span>
                        ) : partial ? (
                          <span className="text-label text-fg-2">
                            {formatAmount(cb!.paid)} з {formatAmount(cb!.gross)}
                          </span>
                        ) : (
                          <span className="text-label text-muted-fg">не оплачено</span>
                        )}
                        {onCancelCharge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onCancelCharge(c)}
                                aria-label={`Скасувати: ${c.article}`}
                                className="grid size-6 place-items-center rounded-sm text-subtle hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
                              >
                                <Undo2 className="size-3.5" aria-hidden />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Скасувати з причиною</TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
            {liveCharges.length > 0 && (
              <tr className="bg-muted/20 font-medium">
                {compose && <td />}
                <td className="px-3 py-1.5" colSpan={2}>
                  Нарахування разом
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {formatAmount(bal.chargesDue)}
                </td>
                {hasDeposit && <td />}
              </tr>
            )}
          </tbody>
        )}
      </table>
      {showCharges && cancelled.length > 0 && <CancelledCharges charges={cancelled} rate={rate} />}
      {remainingSlot}
      {footer}
    </div>
  )
}

function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function GroupTotal({
  compose,
  label,
  keyName,
  total,
  paid,
  due,
  checked,
  onToggle,
}: {
  compose: boolean
  label: string
  keyName: ItemKey
  total: number
  paid: number
  due: number
  checked: boolean
  onToggle?: (key: ItemKey, on: boolean) => void
}) {
  const settled = due > 0 && paid >= due
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {compose && !settled && due > 0 && (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onToggle?.(keyName, v === true)}
          aria-label={`Включити в платіж: ${label}`}
          data-testid={`pick-${keyName}`}
        />
      )}
      {settled && <Check className="size-3.5 text-success-fg" aria-label="оплачено" />}
      <span>{formatAmount(total)}</span>
    </span>
  )
}

/** Секція скасованих: запис не зникає, причина і хто скасував лишаються видимими. */
export function CancelledCharges({ charges, rate }: { charges: Charge[]; rate: number }) {
  return (
    <details className="group border-t border-border" data-testid="cancelled-charges">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-label text-muted-fg hover:text-fg">
        <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
        Скасовані нарахування — {charges.length}
      </summary>
      <ul className="flex flex-col gap-1.5 px-3 pb-2.5">
        {charges.map((c) => (
          <li key={c.id} className="flex items-baseline gap-2 text-label">
            <span className="min-w-0 flex-1">
              <span className="text-muted-fg line-through">{c.article}</span>
              <span className="text-fg-2"> — {c.cancelled!.reason}</span>
              <span className="block text-subtle">
                {c.cancelled!.by}, {c.cancelled!.at}
              </span>
            </span>
            <span className="tabular-nums text-muted-fg line-through">{formatAmount(chargeGross(c, rate))}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function EditComposition() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Змінити склад оренди"
          className="grid size-6 place-items-center rounded-sm text-muted-fg hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        Відкриває той самий редактор складу, що на «Оформленні». Доступно, поки оплати не було.
      </TooltipContent>
    </Tooltip>
  )
}
