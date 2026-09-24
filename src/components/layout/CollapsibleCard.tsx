import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible as CollapsiblePrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * Сворачиваемая карточка рейла-сводки: шапка (uppercase-muted заголовок +
 * опц. правый слот + шеврон) — триггер; тело раскрывается/сворачивается со
 * слайд-анимацией (Radix Collapsible, motion-reduce-safe). Один визуальный
 * язык шапки с секциями формы (`FormSection`).
 */
export function CollapsibleCard({
  title,
  right,
  defaultOpen = true,
  testId,
  className,
  children,
}: {
  title: ReactNode
  /** Правый слот шапки (бейдж статуса / счётчик) — рядом с шевроном. */
  right?: ReactNode
  defaultOpen?: boolean
  /** Маркер для прогонів. У продукті не використовується. */
  testId?: string
  /** Для картки, що зростається з сусіднім блоком у спільну рамку. */
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={setOpen}
      data-testid={testId}
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      <CollapsiblePrimitive.Trigger
        className={cn(
          'group flex w-full items-center gap-2 px-3 pt-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-fg',
          // Раскрыта → pb-1.5 (шапка плотно к телу). Свёрнута → pb-2.5
          // (симметрично pt-2.5 — иначе текст «прилипал» к нижнему бордеру).
          open ? 'pb-1.5' : 'pb-2.5',
        )}
      >
        <h2 className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
          {title}
        </h2>
        <span className="ml-auto flex items-center gap-2">
          {right}
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 text-subtle transition-transform duration-200 group-hover:text-fg-2',
              !open && '-rotate-90',
            )}
            aria-hidden
          />
        </span>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="px-3 pb-3">{children}</div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
