import { Check, Download, FileText, Phone, Sparkles, Wallet } from 'lucide-react'
import { CollapsibleCard } from '@/components/layout/CollapsibleCard'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import type { Invoice, Rent } from '@/mock/types'

/**
 * Правий рейл — липка зведення, яка тримає всю оренду в полі зору незалежно
 * від відкритого етапу: обладнання і термін, контрагент із балансом, рахунок
 * оренди, рахунок застави, документи.
 *
 * Порт `features/rents/detail/RentSummaryRail` — та сама послідовність карток
 * і той самий прогрес-бар рахунку: червоний залишок → зелена заливка →
 * галочка «оплачено».
 */
export function SummaryRail({
  rent,
  historySlot,
}: {
  rent: Rent
  /** Слот під додаткову картку між контрагентом і рахунками. */
  historySlot?: React.ReactNode
}) {
  const cp = rent.counterparty
  return (
    <aside className="flex min-w-0 flex-col gap-3 self-start lg:sticky lg:top-4">
      <CollapsibleCard
        title="Обладнання і термін"
        right={
          <span className="text-label tabular-nums text-muted-fg">
            {rent.issueAt} — {rent.plannedReturnAt}
          </span>
        }
      >
        <div className="flex flex-col gap-1.5">
          {rent.positions.map((p) => (
            <div key={p.id} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-body text-fg">{p.name}</span>
              <span className="shrink-0 text-label tabular-nums text-subtle">×{p.qty}</span>
              <span className="shrink-0 text-label tabular-nums text-muted-fg">
                {formatMoney(p.pricePerDay)}/доба
              </span>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Контрагент">
        <div className="text-body font-medium text-fg">{cp.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-label text-muted-fg">
          <Phone className="size-3.5" aria-hidden />
          {cp.phone}
        </div>
        {cp.edrpou && (
          <div className="mt-0.5 text-label text-muted-fg">
            ЄДРПОУ <span className="font-mono">{cp.edrpou}</span>
          </div>
        )}
        {/* Два незалежні баланси — ніколи не сумуються (BRIEF §4). */}
        <div className="mt-1.5 flex items-center gap-1.5 text-label">
          <Wallet className="size-3.5 text-muted-fg" aria-hidden />
          <span className="text-muted-fg">Рахунок:</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              cp.operationalBalance < 0 ? 'text-danger-fg' : 'text-fg',
            )}
          >
            {formatMoney(cp.operationalBalance)}
          </span>
        </div>
      </CollapsibleCard>


      {historySlot}

      <RailInvoiceCard invoice={rent.rentInvoice} title="Рахунок оренди" />
      <RailInvoiceCard invoice={rent.depositInvoice} title="Рахунок застави" />

      <CollapsibleCard
        title="Документи"
        right={
          <span className="text-label tabular-nums text-muted-fg">
            {rent.documents.filter((d) => !d.pending).length}/{rent.documents.length}
          </span>
        }
      >
        <div className="flex flex-col">
          {rent.documents.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 border-b border-border py-2 last:border-0"
            >
              <FileText
                className={cn('size-3.5 shrink-0', d.pending ? 'text-subtle' : 'text-muted-fg')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-body', d.pending ? 'text-muted-fg' : 'text-fg')}>
                  {d.name}
                </div>
                {!d.pending && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-mono text-accent-fg">{d.number}</span>
                    <span className="font-mono text-mono text-subtle">{d.date}</span>
                    {d.signed === false && <Badge variant="warning">не підписано</Badge>}
                  </div>
                )}
              </div>
              {d.pending ? (
                <Sparkles className="size-3.5 shrink-0 text-subtle" aria-hidden />
              ) : (
                <Download className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </CollapsibleCard>
    </aside>
  )
}

/** Картка рахунку зі смугою оплати — той самий елемент, що в CRM. */
function RailInvoiceCard({ invoice, title }: { invoice: Invoice; title: string }) {
  const paid = invoice.total > 0 && invoice.paid >= invoice.total
  const pct =
    invoice.total > 0 ? Math.min(100, Math.round((invoice.paid / invoice.total) * 100)) : 0
  const remainder = Math.max(0, invoice.total - invoice.paid)
  const extras = invoice.lines.length > 1 ? invoice.lines : null

  return (
    <CollapsibleCard
      title={title}
      right={
        <>
          {invoice.vat && (
            <Badge variant="outline">{invoice.vat === 'with' ? 'з ПДВ' : 'без ПДВ'}</Badge>
          )}
          {paid && (
            <span className="grid size-5 place-items-center rounded-full border border-success bg-success text-white">
              <Check className="size-3" strokeWidth={3} aria-hidden />
              <span className="sr-only">Оплачений</span>
            </span>
          )}
        </>
      }
    >
      <div className="text-headline font-semibold tabular-nums text-fg">
        {formatMoney(invoice.total)}
      </div>
      {invoice.total > 0 && (
        <div
          className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-danger-soft"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-success transition-[width] duration-700 ease-expo-out motion-reduce:transition-none"
            style={{ width: pct + '%' }}
          />
        </div>
      )}
      <div className="mt-1.5 flex justify-between text-label text-muted-fg">
        <span>Оплачено {formatMoney(invoice.paid)}</span>
        {remainder > 0 && (
          <span className="font-medium tabular-nums text-danger-fg">
            Залишок {formatMoney(remainder)}
          </span>
        )}
      </div>
      {extras && (
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          {extras.map((l) => (
            <div key={l.id} className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  'min-w-0 truncate text-label',
                  l.kind === 'discount' ? 'text-warning-fg' : 'text-muted-fg',
                )}
              >
                {l.label}
              </span>
              <span
                className={cn(
                  'shrink-0 text-label tabular-nums',
                  l.amount < 0 ? 'text-danger-fg' : 'text-fg-2',
                )}
              >
                {l.amount < 0 ? '−' : ''}
                {formatMoney(Math.abs(l.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  )
}
