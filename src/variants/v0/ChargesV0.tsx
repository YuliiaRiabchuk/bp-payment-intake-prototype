import { useState } from 'react'
import { ArrowUpRight, Check, Gavel, ReceiptText, Sparkles, Truck, Undo2, Wrench } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { balanceOf, chargeGross, type Balance } from '@/domain/money'
import { useStore } from '@/state/store'
import { useCard } from '@/features/rent/card-context'
import { ChargeForm } from '@/features/rent/shared/ChargeForm'
import { CancelChargeDialog } from '@/features/rent/shared/CancelChargeDialog'
import type { StageTone } from '@/features/rent/StageRail'
import type { Charge } from '@/mock/types'

/**
 * Варіант 0 — «Дод. нарахування» як у проді (кадри 8, 9, 11).
 *
 * Порожній стан — пунктирна картка-кнопка з ілюстрацією. Коли нарахування
 * є — таблиця «Нарахування / Без ПДВ / ПДВ / Нараховано / Залишок» з
 * фільтром «Неоплачені / Оплачені» і власною сумою «Залишок за доплатами»
 * (ще одна поверхня «скільки ще»). Скасовані рядки просто зникають: секція
 * історії в коді CRM є, але не рендериться.
 */

export function chargesNode(rent: ReturnType<typeof useStore>['rent'], bal: Balance, formOpen: boolean): {
  tone: StageTone
  pill: string
} {
  const live = bal.charges.filter((c) => !c.charge.cancelled)
  const discounts = rent.charges.filter((c) => c.kind === 'discount' && !c.cancelled)
  if (formOpen) return { tone: 'editing', pill: 'Додавання' }
  if (bal.chargesRemaining > 0)
    return { tone: bal.chargesPaid > 0 ? 'partial' : 'ready', pill: 'Нараховано' }
  if (live.length + discounts.length > 0) return { tone: 'done', pill: 'Оплачено' }
  return { tone: 'idle', pill: 'Немає нарахувань' }
}

export function ChargesV0() {
  const { rent } = useStore()
  const { chargeForm, closeChargeForm, openChargeForm } = useCard()
  const bal = balanceOf(rent)
  const [filter, setFilter] = useState<'unpaid' | 'paid'>('unpaid')
  const [cancelling, setCancelling] = useState<Charge | null>(null)

  const rows = rent.charges.filter((c) => !c.cancelled)
  const rowBalance = (c: Charge) => bal.charges.find((b) => b.charge.id === c.id)
  const isPaid = (c: Charge) => c.kind === 'discount' || (rowBalance(c)?.remaining ?? 0) <= 0
  const unpaid = rows.filter((c) => !isPaid(c))
  const paid = rows.filter(isPaid)
  const shown = filter === 'unpaid' ? unpaid : paid

  return (
    <div className="flex flex-col gap-3" data-testid="v0-charges">
      {chargeForm && <ChargeForm kind={chargeForm} onDone={closeChargeForm} onCancel={closeChargeForm} />}

      {rows.length === 0 ? (
        !chargeForm && (
          <button
            type="button"
            onClick={() => openChargeForm('charge')}
            className="group flex w-full items-center gap-4 rounded-lg border border-dashed border-border-strong bg-card px-4 py-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
            data-testid="charges-empty"
          >
            <span className="relative h-14 w-20 shrink-0" aria-hidden>
              <span className="absolute left-0 top-1 grid size-8 -rotate-12 place-items-center rounded-full border border-border bg-muted/60">
                <Truck className="size-4 text-muted-fg" />
              </span>
              <span className="absolute left-6 top-0 grid h-12 w-10 place-items-center rounded-md border border-border-strong bg-card">
                <ReceiptText className="size-5 text-fg-2" />
              </span>
              <span className="absolute left-12 top-5 grid size-8 rotate-12 place-items-center rounded-full border border-border bg-muted/60">
                <Wrench className="size-4 text-muted-fg" />
              </span>
              <span className="absolute left-[3.6rem] top-9 grid size-4 place-items-center rounded-full bg-fg text-[10px] font-bold text-primary-fg">+</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium text-fg">Додаткових нарахувань поки немає</span>
              <span className="block text-label text-muted-fg">
                Доставка, послуги та інші витрати за орендою з’являться тут.
              </span>
            </span>
            <span className="hidden items-center gap-1 text-body text-muted-fg sm:flex">
              Додати <ArrowUpRight className="size-3.5" aria-hidden />
            </span>
          </button>
        )
      ) : (
        <div className="rounded-lg border border-border bg-card p-3" data-testid="surcharge-records">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'unpaid', label: <>Неоплачені <span className="text-muted-fg">{unpaid.length}</span></> },
                { value: 'paid', label: <>Оплачені <span className="text-muted-fg">{paid.length}</span></> },
              ]}
            />
            <span className="text-label text-muted-fg">
              Залишок за доплатами{' '}
              <span className="font-semibold tabular-nums text-fg" data-remaining="charges-total">
                {formatMoney(bal.chargesRemaining)}
              </span>
            </span>
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full table-fixed text-body">
              <colgroup>
                <col />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-28" />
                <col className="w-10" />
              </colgroup>
              <thead>
                <tr className="bg-muted/30 text-mono uppercase tracking-[0.04em] text-muted-fg [&>th]:border-b [&>th]:border-border [&>th]:py-1.5 [&>th]:font-semibold">
                  <th className="px-3 text-left">Нарахування</th>
                  <th className="pr-3 text-right">Без ПДВ</th>
                  <th className="pr-3 text-right">ПДВ</th>
                  <th className="pr-3 text-right">Нараховано</th>
                  <th className="pr-3 text-right">Залишок</th>
                  <th>
                    <span className="sr-only">Дії</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-muted-fg">
                      {filter === 'unpaid' ? '✓ Усі нарахування оплачені' : 'Оплачених нарахувань поки немає'}
                    </td>
                  </tr>
                )}
                {shown.map((c) => {
                  const rb = rowBalance(c)
                  const sign = c.kind === 'discount' ? -1 : 1
                  const total = sign * chargeGross(c, bal.rate)
                  const vat = total - sign * c.net
                  return (
                    <tr key={c.id} className="h-12.5 border-b border-border last:border-b-0 [&>td]:border-b [&>td]:border-border">
                      <td className="px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/50">
                            <ChargeIcon article={c.article} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-body text-fg">{c.article}</span>
                            <span className="block truncate text-label text-muted-fg">{c.target}</span>
                          </span>
                        </div>
                      </td>
                      <td className="pr-3 text-right tabular-nums">{formatAmount(sign * c.net)} ₴</td>
                      <td className="pr-3 text-right tabular-nums text-muted-fg">{formatAmount(vat)} ₴</td>
                      <td className="pr-3 text-right font-semibold tabular-nums">{formatAmount(total)} ₴</td>
                      <td className="pr-3 text-right tabular-nums">
                        {c.kind === 'discount' || (rb?.remaining ?? 0) <= 0 ? (
                          <span className="inline-flex items-center gap-1 text-success-fg">
                            <Check className="size-3.5" aria-hidden />
                            Оплачено
                          </span>
                        ) : (
                          <span data-remaining="charge-line">{formatAmount(rb?.remaining ?? 0)} ₴</span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => setCancelling(c)}
                          aria-label="Скасувати нарахування"
                          title="Скасувати нарахування"
                          className="grid size-7 place-items-center rounded-sm text-muted-fg hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
                        >
                          <Undo2 className="size-3.5" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className={cn('h-9 bg-muted/30 font-medium', shown.length === 0 && 'hidden')}>
                  <td className="px-3">Разом за фільтром</td>
                  <td className="pr-3 text-right tabular-nums">
                    {formatAmount(shown.reduce((s, c) => s + (c.kind === 'discount' ? -c.net : c.net), 0))} ₴
                  </td>
                  <td className="pr-3 text-right tabular-nums">
                    {formatAmount(
                      shown.reduce((s, c) => {
                        const sign = c.kind === 'discount' ? -1 : 1
                        return s + sign * (chargeGross(c, bal.rate) - c.net)
                      }, 0),
                    )}{' '}
                    ₴
                  </td>
                  <td className="pr-3 text-right tabular-nums">
                    {formatAmount(
                      shown.reduce((s, c) => s + (c.kind === 'discount' ? -1 : 1) * chargeGross(c, bal.rate), 0),
                    )}{' '}
                    ₴
                  </td>
                  <td className="pr-3 text-right tabular-nums">
                    {formatAmount(shown.reduce((s, c) => s + (rowBalance(c)?.remaining ?? 0), 0))} ₴
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      <CancelChargeDialog charge={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}

export function ChargeIcon({ article, className = 'size-4 text-muted-fg' }: { article: string; className?: string }) {
  const a = article.toLowerCase()
  const Icon = a.includes('достав')
    ? Truck
    : a.includes('мийк') || a.includes('митт') || a.includes('хімі')
      ? Sparkles
      : a.includes('штраф') || a.includes('пошкод')
        ? Gavel
        : ReceiptText
  return <Icon className={className} aria-hidden />
}
