import { ChevronLeft, Copy, History, MoreHorizontal, PackageCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Rent } from '@/mock/types'

/**
 * Шапка картки оренди (кадри 1 і 11): ім'я контрагента, код оренди з
 * копіюванням, статус, номер 1С, активні оренди клієнта, хто оформив.
 * Праворуч «Хронологія» і меню. Нижче — таби картки.
 *
 * `nowAction` — кнопка «Зараз: Перейти до видачі». У чинному проді вона
 * дублює «До видачі» внизу кроку (кадр 11), тож показується тільки у
 * варіанті 0.
 */
export function RentHeader({
  rent,
  onOpenTimeline,
  nowAction,
  onNowAction,
}: {
  rent: Rent
  onOpenTimeline: () => void
  nowAction?: boolean
  onNowAction?: () => void
}) {
  return (
    <header className="bg-card px-4">
      <div className="mx-auto flex max-w-page items-start justify-between gap-3 pt-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button variant="ghost" size="icon" aria-label="Назад до реєстру оренд" className="size-control shrink-0">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-headline font-semibold tracking-tight" data-testid="rent-title">
              {rent.counterparty.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-body font-semibold text-fg-2">
                {rent.code}
                <Copy className="size-3 text-muted-fg" aria-hidden />
              </span>
              <Badge variant="warning">Очікує оплати</Badge>
              <Badge variant="outline">1С: очікує №</Badge>
              <Badge variant="outline">Активних оренд: {rent.counterparty.activeRents}</Badge>
              <span className="flex items-center gap-1.5 text-label text-muted-fg">
                Оформлена:
                <span className="grid size-5 place-items-center rounded-full bg-teal-soft text-mono font-semibold text-teal-fg">
                  {rent.manager.initials}
                </span>
                <span className="text-fg-2">{rent.manager.name}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {nowAction && (
            <button
              type="button"
              onClick={onNowAction}
              data-testid="header-now-action"
              className="mr-2 flex items-center gap-2 rounded-lg border border-success/40 bg-success-soft/60 px-2.5 py-1 text-left hover:bg-success-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
            >
              <span className="grid size-6 place-items-center rounded-md bg-success text-white">
                <PackageCheck className="size-3.5" aria-hidden />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-mono font-semibold uppercase tracking-[0.04em] text-success-fg">Зараз</span>
                <span className="text-body font-medium text-fg">Перейти до видачі</span>
              </span>
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={onOpenTimeline} data-testid="open-timeline">
            <History className="size-3.5" aria-hidden />
            Хронологія
          </Button>
          <Button variant="ghost" size="icon" aria-label="Ще дії">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      <nav className="mx-auto mt-2 flex max-w-page gap-5 pl-10" aria-label="Розділи оренди">
        {['Оренда', 'Документи', 'Оренди клієнта', 'Реєстр платежів', 'Клієнт'].map((t, i) => (
          <span
            key={t}
            aria-current={i === 0 ? 'page' : undefined}
            className={cn(
              'border-b-2 pb-2 text-body',
              i === 0 ? 'border-fg font-medium text-fg' : 'border-transparent text-muted-fg',
            )}
          >
            {t}
          </span>
        ))}
      </nav>
    </header>
  )
}
