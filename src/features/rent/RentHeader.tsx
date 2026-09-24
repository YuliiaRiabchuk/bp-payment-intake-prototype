import { ChevronLeft, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { statusLabel } from './stages'
import type { Rent } from '@/mock/types'

/**
 * Хедер картки оренди: ім'я контрагента, людський ID, бейдж статусу, номер
 * документа в 1С, відповідальний менеджер. Порт `features/rents/detail/Header`
 * — та сама анатомія, тільки без роутера і без кебаба з живими діями.
 */

const STATUS_VARIANT: Record<
  Rent['status'],
  'default' | 'success' | 'warning' | 'danger' | 'accent' | 'outline'
> = {
  DRAFT: 'outline',
  PENDING_PAYMENT: 'accent',
  PENDING_HANDOVER: 'accent',
  ACTIVE: 'success',
  EXPIRING_SOON: 'warning',
  OVERDUE: 'danger',
  AWAITING_CLOSURE: 'accent',
  CLOSED: 'default',
}

export function RentHeader({
  rent,
  onOpenTimeline,
}: {
  rent: Rent
  /** Веде в кадр «Хронологія і гроші». Без нього кнопка лишається німою. */
  onOpenTimeline?: () => void
}) {
  return (
    // Межа знизу тут НЕ малюється: шапка і степер — один блок білої хроми, і
    // лінія в нього одна, під степером. Кадри без степера додають межу самі
    // (обгортка в `RentCardTarget`).
    <header className="bg-card px-4">
      <div className="mx-auto flex max-w-page items-start justify-between gap-3 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Назад до реєстру оренд"
            className="size-control shrink-0"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-headline font-semibold tracking-tight">
              {rent.counterparty.name}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-body font-semibold text-fg-2">
                {rent.displayCode}
              </span>
              <Badge variant={STATUS_VARIANT[rent.status]} dot>
                {statusLabel(rent.status)}
              </Badge>
              <Badge variant="outline">{rent.externalId1c}</Badge>
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
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onOpenTimeline}
          data-testid="open-timeline"
        >
          <History className="size-3.5" aria-hidden />
          Хронологія
        </Button>
      </div>
    </header>
  )
}
