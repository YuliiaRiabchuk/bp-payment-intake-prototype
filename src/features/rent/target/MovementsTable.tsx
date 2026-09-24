import { useMemo, useState } from 'react'
import { ArrowLeft, FileText, Printer, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { profileOf, STATE_LABEL } from '@/mock/counterparty'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import {
  GROUP_LABEL,
  MOVEMENT_GROUP,
  MOVEMENT_LABEL,
  movementTotals,
  movementsOf,
  type MovementGroup,
} from '@/mock/movements'
import type { Rent } from '@/mock/types'

/**
 * Таблиця фінансових рухів по оренді.
 *
 * Це НЕ новий екран. Це та сама таблиця операцій, якою бізнес користується у
 * взаєморозрахунках контрагента, наведена на одну оренду: ті самі колонки
 * (дата, операція, документ, сума), той самий словник видів проводок, той
 * самий принцип «знак важливіший за колір». Різниця лише в області: там
 * контрагент цілком, тут одна оренда.
 *
 * Питання, на яке вона відповідає, одне: коли клієнт сперечається, з чого
 * склалась сума і як система її порахувала.
 *
 * Дві дельти до таблиці взаєморозрахунків контрагента:
 *
 *  1. **Розріз по оренді.** У клієнта їх буває три, а сальдо по контрагенту
 *     показує одну цифру — і саме на ній розмова заходить у глухий кут.
 *     Перемикач угорі каже, яку оренду зараз читаємо, і дає перейти на
 *     сусідню, не виходячи з екрана.
 *  2. **Друк.** Клієнт просить роздрукувати взаєморозрахунки по своїй
 *     оренді; за формою це виписка як з банку. Друкується сама таблиця з
 *     шапкою — фільтри, кнопки й решта інтерфейсу з аркуша зникають
 *     (`print:hidden`), тому окремої «версії для друку» не існує.
 */
export function MovementsTable({
  rent,
  onBack,
}: {
  rent: Rent
  /** Кнопка «До оренди» — лише коли таблиця відкрита кадром, а не табою.
   *  У табі навігацію тримає смуга табів, і друга дорога назад зайва. */
  onBack?: () => void
}) {
  const [group, setGroup] = useState<MovementGroup | 'all'>('all')
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<string>('all')

  const all = useMemo(() => movementsOf(rent), [rent])
  const others = profileOf(rent).others

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((m) => {
      if (group !== 'all' && MOVEMENT_GROUP[m.kind] !== group) return false
      if (position !== 'all' && m.positionId !== position) return false
      if (!q) return true
      return (
        m.detail.toLowerCase().includes(q) ||
        MOVEMENT_LABEL[m.kind].toLowerCase().includes(q) ||
        (m.document ?? '').toLowerCase().includes(q)
      )
    })
  }, [all, group, position, query])

  // Підсумок рахується по рахунку оренди. Застава йде окремим рядком і в
  // сальдо не втягується — це різні гроші з різною долею.
  const totals = movementTotals(rows, 'rent')
  const depositIn = movementTotals(rows, 'deposit').paid

  return (
    // Ширина обмежена читаною мірою. На повних 1180px колонка «Операція»
    // забирала весь запас і в кожному рядку зяяла порожнеча в ~470px між
    // текстом операції і документом.
    <section
      data-testid="movements-table"
      data-public-invoice=""
      className="flex max-w-frame flex-col gap-3"
    >
      {/* `data-public-invoice` — механізм друку, який уже є в системі
          (globals.css §print). Він ховає всю сторінку і показує рівно цю
          гілку; усередині ховається все з `data-print-hide`. Tailwind-класи
          `print:*` тут не працюють: вони не знімають `visibility: hidden`,
          який успадкований блок вішає на `body *`, тож аркуш виходив
          порожній. Переюз готового замість власного друку — і тому, що він
          уже налагоджений, і тому, що інакше в системі буде два друки. */}
      <div data-print-hide="" className="flex flex-wrap items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-3.5" aria-hidden />
            До оренди
          </Button>
        )}
        <h2 className="text-title font-semibold tracking-tight">
          Реєстр платежів — {rent.displayCode}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => window.print()}
          data-testid="movements-print"
        >
          <Printer className="size-3.5" aria-hidden />
          Друк виписки
        </Button>
      </div>

      {/* Шапка аркуша. На екрані її немає — вона потрібна тільки коли лист
          пішов клієнту і має сам себе пояснити. */}
      <div className="hidden print:block print:mb-3">
        <h1 className="text-headline font-semibold">
          Взаєморозрахунки за орендою {rent.displayCode}
        </h1>
        <p className="text-body text-fg-2">
          {rent.counterparty.name}
          {rent.counterparty.edrpou && ` — ЄДРПОУ ${rent.counterparty.edrpou}`}
        </p>
        <p className="text-label text-muted-fg">
          Період {rent.issueAt} — {rent.plannedReturnAt}
        </p>
      </div>

      {/* Розріз по оренді. Поточна стоїть першою і вибрана: екран відкрився
          з неї, і зміна активної позиції на вході читалась би як підміна. */}
      {others.length > 0 && (
        <div data-print-hide=""
          className="flex flex-wrap items-center gap-2">
          <span className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
            Оренда
          </span>
          <SegmentedControl
            value={rent.id}
            onChange={() => {
              /* Перехід на сусідню оренду — за межами прототипу: інших
                 орендних карток тут не існує. Кнопка лишається живою, щоб
                 було видно сам розріз. */
            }}
            options={[
              { value: rent.id, label: rent.displayCode },
              ...others.map((o) => ({
                value: o.id,
                label: `${o.displayCode} — ${STATE_LABEL[o.state]}`,
              })),
            ]}
            ariaLabel="Оренда контрагента"
          />
        </div>
      )}

      {/* Фільтри одним рядом: група, позиція, пошук. Три способи звузити,
          жоден не ховає інші. */}
      <div data-print-hide=""
          className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={group}
          onChange={(g) => setGroup(g as MovementGroup | 'all')}
          options={[
            { value: 'all', label: 'Усі' },
            { value: 'charges', label: GROUP_LABEL.charges },
            { value: 'payments', label: GROUP_LABEL.payments },
            { value: 'corrections', label: GROUP_LABEL.corrections },
          ]}
          ariaLabel="Група операцій"
        />
        {rent.positions.length > 1 && (
          <SegmentedControl
            value={position}
            onChange={setPosition}
            options={[
              { value: 'all', label: 'Уся оренда' },
              ...rent.positions.map((p) => ({
                value: p.id,
                label: p.name.split(' ').slice(0, 2).join(' '),
              })),
            ]}
            ariaLabel="Позиція оренди"
          />
        )}
        <div className="flex h-7 min-w-52 flex-1 items-center gap-2 rounded-md border border-border-strong bg-card px-2.5 transition-colors focus-within:border-border-focus">
          <Search className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук по операціях і документах"
            aria-label="Пошук по рухах"
            className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-muted-fg"
          />
        </div>
      </div>

      {/* Та сама стратегія, що й у касі: таблиця стискається до своєї
          мінімальної ширини і далі скролить горизонтально всередині картки.
          Раніше одна з двох сусідніх таблиць скролила, а друга мовчки
          тиснула колонки. */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[40rem]">
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_8rem] gap-3 border-b border-border bg-muted/40 px-3 py-1.5 text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
          <span>Дата</span>
          <span>Операція і документ</span>
          <span className="text-right">Сума</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-3 py-6 text-body text-muted-fg">
            За цим фільтром рухів немає.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((m) => (
              <div
                key={m.id}
                data-testid="movement-row"
                className={cn(
                  'grid grid-cols-[6.5rem_minmax(0,1fr)_8rem] items-baseline gap-3 px-3 py-2',
                  m.cancelled && 'opacity-55',
                )}
              >
                <span className="text-label tabular-nums text-muted-fg">{m.at}</span>
                <div className="min-w-0">
                  <div
                    className={cn(
                      'truncate text-body font-medium text-fg',
                      m.cancelled && 'line-through',
                    )}
                  >
                    {MOVEMENT_LABEL[m.kind]}
                  </div>
                  {/* Документ стоїть при операції, а не окремою колонкою:
                      на власній осі він лишав у кожному рядку порожнечу в
                      кілька сотень пікселів, хоча є довідкою до сусіднього
                      тексту, а не самостійною величиною. */}
                  <div className="flex flex-wrap items-baseline gap-x-2 text-label text-muted-fg">
                    <span className="min-w-0 truncate">{m.detail}</span>
                    {m.document && (
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-mono text-accent-fg">
                        <FileText className="size-3 shrink-0" aria-hidden />
                        {m.document}
                      </span>
                    )}
                  </div>
                </div>
                {/* Знак несе сенс: «+» збільшує борг клієнта, «−» зменшує.
                    Колір лише підсилює знак, а не замінює його. */}
                <span
                  className={cn(
                    'text-right text-body font-semibold tabular-nums',
                    m.cancelled
                      ? 'text-muted-fg line-through'
                      : m.amount > 0
                        ? 'text-danger-fg'
                        : 'text-success-fg',
                  )}
                >
                  {m.amount > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(m.amount))}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_8rem] gap-3 border-t border-border bg-muted/30 px-3 py-2">
          <span className="text-label text-muted-fg">
            {rows.length} з {all.length}
          </span>
          <span className="text-label text-muted-fg">
            Оренда: нараховано {formatMoney(totals.charged)}, прийнято{' '}
            {formatMoney(totals.paid)}
            {depositIn > 0 && (
              <>
                {' '}
                <span className="text-subtle">—</span> застава{' '}
                {formatMoney(depositIn)}
              </>
            )}
          </span>
          <span className="text-right">
            {/* Голе число в підвалі не читається: без слова незрозуміло,
                це борг, переплата чи оборот. */}
            <span className="block text-mono uppercase tracking-[0.04em] text-muted-fg">
              {totals.balance > 0 ? 'Залишок' : totals.balance < 0 ? 'Переплата' : 'Розрахунок закритий'}
            </span>
            <span
              className={cn(
                'block text-body font-semibold tabular-nums',
                totals.balance > 0 ? 'text-danger-fg' : 'text-success-fg',
              )}
            >
              {formatMoney(Math.abs(totals.balance))}
            </span>
          </span>
        </div>
        </div>
      </div>
    </section>
  )
}
