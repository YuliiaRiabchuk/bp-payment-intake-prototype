import { useState } from 'react'
import { Pencil, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoney } from '@/lib/money'
import { balanceOf } from '@/domain/money'
import { useStore } from '@/state/store'

/**
 * Варіант 0 — «Рахунки до оплати» як у проді (кадри 1, 11).
 *
 * Дві картки з сумою і олівцем. Сума «Рахунку оренди» — оренда РАЗОМ із
 * доп. нарахуваннями (`totalAmount` = RENT + RENT_TOPUP), тому на кадрі 11
 * там 3 100: 2 100 оренди і 1 000 доставки, яку нижче показано ще двічі.
 * Складу з карток не видно. Олівець живе, поки не вибрано жодного способу
 * і нічого не оплачено.
 */
export function InvoicesV0() {
  const { rent } = useStore()
  const bal = balanceOf(rent)
  const ul = rent.party === 'ul'
  const editable = rent.drafts.every((d) => !d.method) && bal.rent.paid + bal.deposit.paid <= 0
  return (
    <div className="rounded-lg border border-border bg-card p-3" data-testid="v0-invoices">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InvoiceCard
          icon={<Wallet className="size-3.5 text-muted-fg" aria-hidden />}
          label="Рахунок оренди"
          badge={ul ? (bal.rate > 0 ? 'з ПДВ' : 'без ПДВ') : undefined}
          amount={bal.rentAccount.due}
          editable={editable}
          recommended={bal.rent.gross}
        />
        <InvoiceCard
          icon={<ShieldCheck className="size-3.5 text-muted-fg" aria-hidden />}
          label="Рахунок застави"
          badge={ul ? 'без ПДВ' : undefined}
          amount={bal.deposit.due}
          editable={editable}
          recommended={bal.deposit.due}
          zeroWarning={bal.deposit.due <= 0}
        />
      </div>
    </div>
  )
}

function InvoiceCard({
  icon,
  label,
  badge,
  amount,
  editable,
  recommended,
  zeroWarning,
}: {
  icon: React.ReactNode
  label: string
  badge?: string
  amount: number
  editable: boolean
  recommended: number
  zeroWarning?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex min-h-6 items-center gap-1.5">
        {icon}
        <span className="text-body font-medium text-fg-2">{label}</span>
        {badge && <span className="rounded-sm bg-muted px-1.5 text-mono text-muted-fg">{badge}</span>}
        <span className="ml-auto flex items-center gap-1">
          {zeroWarning && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="grid size-6 place-items-center text-warning-fg" aria-label="Заставу не прийнято">
                  <TriangleAlert className="size-3.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent>Рахунок застави — 0 ₴, заставу не прийнято</TooltipContent>
            </Tooltip>
          )}
          {editable && <PriceEditor label={label} value={amount} recommended={recommended} />}
        </span>
      </div>
      <div className="text-headline font-semibold leading-none tabular-nums">{formatMoney(amount)}</div>
    </div>
  )
}

/** Порт `PriceAdjustEditor`: знижка / надбавка / точна ціна. У прототипі не зберігає. */
function PriceEditor({ label, value, recommended }: { label: string; value: number; recommended: number }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'minus' | 'plus' | 'set'>('set')
  const [unit, setUnit] = useState<'pct' | 'uah'>('uah')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Редагувати ${label.toLowerCase()}`}
          title={`Редагувати ${label.toLowerCase()}`}
          className="grid size-6 place-items-center rounded-sm text-muted-fg hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" data-popover-id="price">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-body font-medium">Ціна</span>
          <span className="text-label text-muted-fg">реком. {formatMoney(recommended)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'minus', label: '−', title: 'Знижка' },
              { value: 'plus', label: '+', title: 'Надбавка' },
              { value: 'set', label: '=', title: 'Точна ціна' },
            ]}
          />
          <input
            defaultValue={value}
            aria-label="Значення"
            className="h-6 min-w-0 flex-1 rounded-sm border border-border-strong px-1.5 text-right text-body tabular-nums outline-none focus:border-fg/50"
          />
          <SegmentedControl
            size="sm"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'pct', label: '%', title: 'Відсоток' },
              { value: 'uah', label: '₴', title: 'Сума' },
            ]}
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Скинути
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Застосувати
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
