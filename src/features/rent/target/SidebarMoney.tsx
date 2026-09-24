import { ArrowUpRight, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollapsibleCard } from '@/components/layout/CollapsibleCard'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { movementsOf, movementTotals } from '@/mock/movements'
import { outstandingAmount, withheldAmount } from '@/state/rent-store'
import { useLab } from '@/lab/lab-state'
import type { Rent } from '@/mock/types'

/**
 * Грошова група правого сайдбара.
 *
 * Три різні класи об'єкта, і це навмисно — щоб «кнопка є завжди» не читалось
 * як «блок є завжди»:
 *
 *  1. `Рахунок оренди` — картка. Довідка про суму.
 *  2. `+ доп. нарахування` — РЯДОК-ПОСИЛАННЯ без рамки, приклеєний до
 *     картки рахунку. Не форма і не блок: він нікуди не розгортається, він
 *     веде на крок «Оплата». Порожнього блока з нього не виникає, бо блока
 *     немає взагалі.
 *  3. `Рух коштів` — картка, і вона з'являється тільки коли рухи є.
 */

export function SidebarMoneyLink({
  rent,
  onAddSurcharge,
  standalone,
}: {
  rent: Rent
  onAddSurcharge: () => void
  /** Картки рахунку поруч немає — кнопка стоїть сама і замикається сама. */
  standalone?: boolean
}) {
  const { stage } = useLab()
  const outstanding = outstandingAmount(rent)
  const hasDebt = outstanding > 0

  return (
    <button
      type="button"
      onClick={onAddSurcharge}
      data-testid="sidebar-add-surcharge"
      className={cn(
        // Кнопка — продовження картки рахунку, тому вони ділять ОДНУ межу.
        //
        // Раніше тут стояв `-mt-3`: кнопку підтягували на 12px, щоб накрити
        // нижню межу картки її фоном. Трюк давав або дві лінії за 12px одна
        // від одної (коли верхня межа була), або жодної (коли не було).
        // Накладання прибране: картка втратила нижню межу і нижнє
        // заокруглення, кнопка втратила верхнє — між ними рівно одна лінія,
        // її власна верхня.
        'flex w-full items-center gap-2 border px-3 py-2 text-left transition-colors',
        standalone ? 'rounded-lg' : 'rounded-b-lg rounded-t-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg',
        hasDebt
          ? 'border-danger/30 bg-danger-soft/40 hover:bg-danger-soft/70'
          : 'border-border bg-card hover:bg-muted',
      )}
    >
      <Plus
        className={cn('size-3.5 shrink-0', hasDebt ? 'text-danger-fg' : 'text-muted-fg')}
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-body text-fg-2">Додати нарахування</span>
      {/* Стрілка вгору-вбік — знак, що це посилання, а не розкриття. */}
      <ArrowUpRight
        className="size-3.5 shrink-0 text-subtle"
        aria-label={stage === 'payment' ? undefined : 'відкриє крок «Оплата»'}
      />
    </button>
  )
}

/**
 * Рух коштів: те, чого немає в рахунках, плюс дороги в книги операцій.
 *
 * Картки тут може не бути зовсім. Коли по оренді немає ні утримання із
 * застави, ні боргу, залишаються два посилання — а заголовок над двома
 * посиланнями це і є той порожній блок, якого бриф просив уникати. Тому в
 * такому разі посилання стоять голими, без рамки і без назви: вони не
 * зведення, вони дороги.
 */
export function SidebarMoneyFlow({
  rent,
  onAddSurcharge,
  onOpenMovements,
  onRegistry,
}: {
  rent: Rent
  onAddSurcharge: () => void
  onOpenMovements: () => void
  /** Ми вже в реєстрі: посилання туди зайве, а не просто безкорисне. */
  onRegistry?: boolean
}) {
  const rows = movementsOf(rent)
  if (rows.length === 0) return null

  // Два рахунки — два підсумки. Складати їх не можна навіть візуально: пара
  // «нараховано / прийнято», де прийнято більше, змушує менеджера шукати
  // різницю, якої не існує.
  const depositIn = movementTotals(rows, 'deposit').paid
  const outstanding = outstandingAmount(rent)
  const withheld = withheldAmount(rent)
  const { stage } = useLab()
  /**
   * Хто друкує суму боргу.
   *
   * Рівно один власник на екран. На кроці оплати цифру тримає сам крок — там
   * вона стоїть поруч із роботою, якою її закривають. Звідусіль ще цифру
   * тримає сайдбар, бо в головній колонці її нема. Два власники одночасно —
   * це рівно та вада, на якій розсипався варіант 0: одне число надруковане
   * тричі, і жодне не головне.
   */
  const ownsTotal = stage !== 'payment'

  const hasContent = withheld > 0 || (outstanding > 0 && ownsTotal)

  // Нема чого зводити — лишаються дороги, і вони стоять голими.
  if (!hasContent) {
    return (
      <div data-testid="sidebar-money-flow" className="flex flex-col px-1">
      {/* Дорога, яка веде туди, де ти вже стоїш, — не дорога. На своїй табі
          посилання зникає, а не лишається живим і мовчазним. */}
      {!onRegistry && (
        <button
          type="button"
          onClick={onOpenMovements}
          data-testid="open-movements"
          className="-mx-1 flex min-h-6 w-full items-center gap-1.5 rounded-sm px-1 text-label text-accent-fg underline-offset-2 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          Усі рухи по оренді
          <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
      )}
      </div>
    )
  }

  return (
    <CollapsibleCard title="Рух коштів" testId="sidebar-money-flow">
      {withheld > 0 && (
        <dl className="flex flex-col gap-1">
          <Row
            label="Утримано із застави"
            value={formatMoney(withheld)}
            tone="warning"
          />
          <Row
            label="Застава до повернення"
            value={formatMoney(Math.max(0, depositIn - withheld))}
          />
        </dl>
      )}

      {outstanding > 0 && ownsTotal && (
        // Прострочення і борг — не довідка, а робота. Сума і дія поруч,
        // щоб менеджеру не довелось шукати, чим її закрити.
        <div className="mt-2 rounded-md border border-danger/30 bg-danger-soft/40 px-2.5 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-label text-danger-fg">До доплати</span>
            <span
              className="text-title font-semibold tabular-nums text-danger-fg"
              data-money-total=""
            >
              {formatMoney(outstanding)}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-1.5 w-full justify-center"
            onClick={onAddSurcharge}
            data-testid="sidebar-settle"
          >
            <Wallet className="size-3.5" aria-hidden />
            Прийняти доплату
          </Button>
        </div>
      )}

      <div className="mt-2 flex flex-col">
      {/* Дорога, яка веде туди, де ти вже стоїш, — не дорога. На своїй табі
          посилання зникає, а не лишається живим і мовчазним. */}
      {!onRegistry && (
        <button
          type="button"
          onClick={onOpenMovements}
          data-testid="open-movements"
          className="-mx-1 flex min-h-6 w-full items-center gap-1.5 rounded-sm px-1 text-label text-accent-fg underline-offset-2 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          Усі рухи по оренді
          <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
      )}
      </div>
    </CollapsibleCard>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'warning'
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-label text-muted-fg">{label}</dt>
      <dd
        className={cn(
          'text-label font-medium tabular-nums',
          tone === 'success' && 'text-success-fg',
          tone === 'warning' && 'text-warning-fg',
          !tone && 'text-fg',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
