import { ArrowRight, ArrowUpRight, Briefcase, Building2, ChevronDown, Copy, Package, Phone, Plus, Repeat, Wallet, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { CollapsibleCard } from '@/components/layout/CollapsibleCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoneyStateBar } from '@/components/money-bar'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'
import { balanceOf, gross, lineNet } from '@/domain/money'
import { cashboxOf, MANAGER } from '@/mock/cashboxes'
import { useStore } from '@/state/store'
import { useCard } from '@/features/rent/card-context'

/**
 * Варіант 0 — правий сайдбар чинного проду (кадри 10, 11).
 *
 * Порт `RentSummaryRail`: «Обладнання і термін», «Контрагент» з балансом
 * без пояснення, «РАСЧЁТЫ ПО АРЕНДЕ» з бейджем «долг», «Застава» з «у нас»,
 * «Документи». Російські рядки відтворено навмисно: так їх бачать сьогодні
 * (порожній `uk` у локалі CRM). Це антиреференс, не пропозиція.
 */
export function RailV0() {
  const { rent } = useStore()
  const { openChargeForm } = useCard()
  const bal = balanceOf(rent)
  const cp = rent.counterparty
  const fop = cashboxOf('cb-kur-1')!.org.replace(/^ФОП /, '')
  const debt = bal.rentAccount.remaining
  const overpay = bal.overpay
  const [more, setMore] = useState(false)

  const rentRows: { key: string; label: string; amount: number; owed: boolean; of?: number }[] = [
    ...rent.positions.map((p) => ({
      key: p.id,
      label: p.name,
      amount: gross(lineNet(p), bal.rate),
      owed: false,
    })),
    ...bal.charges
      .filter((c) => !c.charge.cancelled)
      .map((c) => ({ key: c.charge.id, label: c.charge.article, amount: c.remaining > 0 ? c.remaining : c.gross, owed: c.remaining > 0, of: c.remaining > 0 && c.paid > 0 ? c.gross : undefined })),
  ]
  if (bal.rent.remaining > 0) {
    rentRows.forEach((r) => {
      if (rent.positions.some((p) => p.id === r.key)) r.owed = true
    })
  }
  const visible = more ? rentRows : rentRows.filter((r, i) => i < 3 || r.owed)
  const hidden = rentRows.length - visible.length

  return (
    <div className="flex flex-col gap-3.5" data-testid="rail-v0">
      <CollapsibleCard
        title="Обладнання і термін"
        right={<span className="text-mono text-subtle">24 сент. – 1 окт.</span>}
      >
        <dl className="flex flex-col gap-1.5 border-b border-border pb-2 text-body">
          <Row icon={<Warehouse className="size-3.5" />} label="Склад" value={rent.warehouse} />
          <Row
            icon={rent.party === 'ul' ? <Building2 className="size-3.5" /> : <Briefcase className="size-3.5" />}
            label={rent.party === 'ul' ? 'ТОВ' : 'ФОП'}
            value={fop}
          />
        </dl>
        <dl className="flex flex-col gap-1.5 border-b border-border py-2 text-body">
          <Row label="Выдача (план)" value={rent.issueAt} />
          <Row label="Повернення (план)" value={rent.returnAt} />
        </dl>
        <div className="pt-2">
          <div className="flex justify-between text-body">
            <span className="text-muted-fg">Обладнання</span>
            <span className="tabular-nums">
              {formatMoney(rent.positions.reduce((s, p) => s + (p.kind === 'consumable' ? 0 : p.price * p.qty), 0))}/сутки
            </span>
          </div>
          {rent.positions.map((p) => (
            <div key={p.id} className="mt-1.5 flex items-center gap-2 text-body">
              <Package className="size-4 shrink-0 text-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <span className="text-label text-muted-fg">×{p.qty}</span>
              <span className="text-label tabular-nums text-muted-fg">{formatMoney(p.price)}</span>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Контрагент">
        <div className="text-body font-medium">{cp.name}</div>
        <div className="mt-1 flex flex-col gap-1 text-label text-muted-fg">
          <span className="flex items-center gap-1.5">
            <Phone className="size-3.5" aria-hidden />
            {cp.phone}
            <Copy className="size-3" aria-hidden />
          </span>
          {rent.party === 'fl' && (
            <span className="flex items-center gap-1.5">
              <Wallet className="size-3.5" aria-hidden />
              Баланс контрагента:
              <span className={cn('font-semibold tabular-nums', cp.wallet < 0 ? 'text-danger-fg' : 'text-fg')}>
                {formatMoney(cp.wallet)}
              </span>
            </span>
          )}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" variant="secondary" className="flex-1">
            <Repeat className="size-3.5" aria-hidden />
            Змінити профіль
          </Button>
          <Button size="sm" variant="secondary" className="flex-1">
            Докладніше
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </CollapsibleCard>

      <div className="overflow-hidden rounded-lg border border-border bg-card" data-testid="v0-settlement">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <h2 className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">Расчёты по аренде</h2>
          <span className="ml-auto flex items-center gap-2">
            {debt > 0 ? (
              <Badge variant="danger">долг</Badge>
            ) : overpay > 0 ? (
              <Badge variant="warning">переплата</Badge>
            ) : (
              <Badge variant="success">оплачено</Badge>
            )}
            {rent.party === 'ul' && <Badge variant="outline">{bal.rate > 0 ? 'з ПДВ' : 'без ПДВ'}</Badge>}
            <ChevronDown className="size-3.5 text-subtle" aria-hidden />
          </span>
        </div>
        <div className="px-3 pb-3 pt-1.5">
          <div
            className={cn(
              'text-[22px] font-semibold tabular-nums',
              debt > 0 ? 'text-danger-fg' : overpay > 0 ? 'text-warning-fg' : 'text-fg',
            )}
            data-remaining={debt > 0 ? 'rail-settlement' : undefined}
          >
            {formatAmount(debt > 0 ? debt : overpay > 0 ? overpay : bal.rentAccount.due)}{' '}
            <span className="text-label font-normal text-subtle">грн</span>
          </div>
          {bal.rentAccount.paid > 0 && (
            <MoneyStateBar
              className="mt-1.5"
              variant="mini"
              total={Math.max(bal.rentAccount.due, bal.rentAccount.paid)}
              named={debt > 0 ? 'missing' : overpay > 0 ? 'over' : undefined}
              segments={[
                { state: 'here', amount: Math.min(bal.rentAccount.paid, bal.rentAccount.due), label: 'Оплачено' },
                { state: 'missing', amount: debt, label: 'Не оплачено' },
                { state: 'over', amount: overpay, label: 'Переплата' },
              ]}
            />
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {visible.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-label">
                <span className={cn('size-2 shrink-0 rounded-full', r.owed ? 'bg-danger' : 'bg-success')} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-muted-fg">{r.label}</span>
                <span className={cn('tabular-nums', r.owed ? 'font-medium text-danger-fg' : 'text-fg')}>
                  {formatAmount(r.amount)}
                  {r.of ? ` з ${formatAmount(r.of)}` : ''}
                </span>
              </li>
            ))}
            {bal.rate > 0 && (
              <li className="flex items-center gap-2 text-label">
                <span className="size-2 shrink-0 rounded-full bg-border-strong" aria-hidden />
                <span className="flex-1 text-muted-fg">ПДВ {bal.rate} %</span>
                <span className="tabular-nums">{formatAmount(bal.rent.vat)}</span>
              </li>
            )}
          </ul>
          {hidden > 0 && (
            <button type="button" onClick={() => setMore(true)} className="mt-1 flex items-center gap-1 text-label text-muted-fg hover:text-fg">
              <ChevronDown className="size-3" aria-hidden />
              ещё {hidden}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 border-t border-border bg-bg/45">
          <button
            type="button"
            onClick={() => openChargeForm('charge')}
            data-testid="rail-add-charge"
            className="flex items-center gap-1.5 border-r border-border px-3 py-2 text-left text-body hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="flex-1">Додати нарахування</span>
            <ArrowUpRight className="size-3.5 text-subtle" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => openChargeForm('discount')}
            data-testid="rail-add-discount"
            className="flex items-center gap-1.5 px-3 py-2 text-left text-body hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="flex-1">Додати знижку</span>
            <ArrowUpRight className="size-3.5 text-subtle" aria-hidden />
          </button>
        </div>
      </div>

      <CollapsibleCard
        title="Застава"
        right={
          bal.deposit.due <= 0 ? (
            <Badge>ні</Badge>
          ) : bal.deposit.remaining > 0 ? (
            <Badge variant="danger">не довнесено</Badge>
          ) : (
            <Badge variant="success">у нас</Badge>
          )
        }
      >
        <div
          className={cn('text-[22px] font-semibold tabular-nums', bal.deposit.remaining > 0 && 'text-danger-fg')}
          data-remaining={bal.deposit.remaining > 0 ? 'rail-deposit' : undefined}
        >
          {formatAmount(bal.deposit.remaining > 0 ? bal.deposit.remaining : bal.deposit.paid)}{' '}
          <span className="text-label font-normal text-subtle">грн</span>
        </div>
        <p className="text-label text-muted-fg">
          {bal.deposit.due <= 0
            ? 'Заставу не прийнято'
            : bal.deposit.remaining > 0
              ? 'Ще надійшов не повністю'
              : 'Повернеться клієнту при закритті оренди'}
        </p>
      </CollapsibleCard>

      <div className="flex h-10 items-center justify-between rounded-lg border border-border bg-card px-3">
        <h2 className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">Документи</h2>
        <Button size="sm" variant="secondary">
          <Plus className="size-3.5" aria-hidden />
          Сформировать
        </Button>
      </div>
      <span className="sr-only">{MANAGER.name}</span>
    </div>
  )
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-muted-fg">
        {icon}
        {label}
      </dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
