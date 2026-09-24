import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormSectionProps {
  /** Без заголовка (и без `titleSlot`/`right`) шапка секции не рисуется вовсе —
   *  секция, чей первый блок сам себя называет, не должна нести пустую полосу
   *  сверху (приём оплаты: подпись суммы живёт над самой суммой). */
  title?: ReactNode
  step?: number
  titleSlot?: ReactNode
  right?: ReactNode
  children: ReactNode
  bodyClassName?: string
  /** Переопределяет `data-testid` секции (дефолт `form-section`). */
  testId?: string
}

/**
 * Chrome aligned with catalog `FormSection`
 * (`apps/crm/src/features/warehouse/forms/section-primitives.tsx`):
 * `rounded-md` outer, muted/50 header band, step badge + 11px uppercase
 * tracked title, body `gap-2.5 p-4`. `titleSlot` / `right` slots preserved.
 */
export function FormSection({
  title,
  step: _step,
  titleSlot,
  right,
  children,
  bodyClassName,
  testId = 'form-section',
}: FormSectionProps) {
  const hasHeader = Boolean(title || titleSlot || right)
  return (
    <section
      data-testid={testId}
      className="rounded-lg border border-border bg-card"
    >
      {hasHeader && (
        <header className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
          {title && (
            <h2 className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
              {title}
            </h2>
          )}
          {titleSlot}
          {/* Слот — РЯД, а не блок: `div` без `flex` ставив бейдж і галочку
              одне під одне, і дві сусідні картки рахунків розʼїжджались по
              базовій лінії на 4px. */}
          {right && (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {right}
            </div>
          )}
        </header>
      )}
      {/* Верхний отступ приходит из шапки; без неё его берёт на себя тело. */}
      <div
        className={cn(
          'flex flex-col gap-2 px-3 pb-3',
          !hasHeader && 'pt-3',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}
