import { useEffect, useRef, useState } from 'react'
import { Check, CircleDashed } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { formatAmount, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import './money-state-bar.css'

export type MoneyState = 'here' | 'elsewhere' | 'gone' | 'missing' | 'over'
export interface MoneyStateSegment {
  state: MoneyState
  amount: number
  label: string
}

const colors: Record<MoneyState, string> = {
  here: 'bg-success text-on-brand',
  elsewhere: 'bg-success-soft text-success-fg ring-1 ring-inset ring-success',
  gone: 'bg-border-strong text-fg',
  missing: 'bg-danger-soft text-danger-fg',
  over: 'bg-warning text-warning-fg',
}

/** Shared, read-only money distribution. Callers supply amounts and their
 * meaning; this component never allocates payments or computes invoice debt.
 * Both sizes use the same geometry, focus/hover feedback and unpaid marker.
 */
export function MoneyStateBar({
  segments,
  total,
  variant = 'default',
  paidTone = 'success',
  named,
  active: controlledActive,
  onActiveChange,
  className,
  testId,
  segmentTestIdPrefix,
}: {
  segments: MoneyStateSegment[]
  total: number
  variant?: 'default' | 'mini'
  paidTone?: 'success' | 'accent'
  /** A mini card can omit the amount already displayed in its heading. */
  named?: MoneyState
  active?: MoneyState | null
  onActiveChange?: (state: MoneyState | null) => void
  className?: string
  testId?: string
  segmentTestIdPrefix?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setWidth(track.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [total])
  const [localActive, setLocalActive] = useState<MoneyState | null>(null)
  const active = controlledActive === undefined ? localActive : controlledActive
  const activate = (state: MoneyState | null) => {
    setLocalActive(state)
    onActiveChange?.(state)
  }
  if (total <= 0) return null
  const visible = segments.filter((segment) => segment.amount > 0)
  return (
    <TooltipProvider>
    <div
      ref={trackRef}
      className={cn('money-state-bar flex w-full rounded-[3px]', className)}
      data-size={variant}
      data-testid={testId}
      role="group"
      aria-label={visible.map((segment) => `${segment.label}: ${formatMoney(segment.amount)}`).join('. ')}
    >
      {visible.map((segment, index) => {
        const amount = formatAmount(segment.amount)
        const labelFits = width * segment.amount / total >= amount.length * 7 + (variant === 'mini' ? 14 : 32)
        const Icon = segment.state === 'missing' ? CircleDashed : Check
        const hasBoundary = segment.state === 'missing' && index > 0 && visible[index - 1]?.state === 'here'
        return (
          <Tooltip key={segment.state}>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                role="img"
                aria-label={`${segment.label}: ${formatMoney(segment.amount)}`}
                data-state={segment.state}
                data-boundary={hasBoundary || undefined}
                data-testid={segmentTestIdPrefix ? `${segmentTestIdPrefix}${segment.state}` : undefined}
                className={cn(
                  'money-state-segment relative min-w-0 shrink-0 cursor-help outline-none transition-[width,opacity] duration-300 motion-reduce:transition-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2',
                  colors[segment.state],
                  segment.state === 'here' && paidTone === 'accent' && 'bg-accent text-on-brand',
                  active && active !== segment.state && 'opacity-40',
                )}
                style={{ width: `${Math.min(segment.amount / total, 1) * 100}%` }}
                onMouseEnter={() => activate(segment.state)}
                onMouseLeave={() => activate(null)}
                onFocus={() => activate(segment.state)}
                onBlur={() => activate(null)}
              >
                {segment.state === 'missing' && <span className="money-unpaid-pattern" aria-hidden />}
                {named !== segment.state && labelFits && (
                  <span
                    className="money-state-value absolute inset-0 flex items-center gap-1 px-1.5 font-medium leading-none tabular-nums"
                    aria-hidden
                  >
                    {variant !== 'mini' && (segment.state === 'here' || segment.state === 'missing') && <Icon className="size-3 shrink-0" />}
                    <span>{amount}</span>
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="flex items-center gap-3">
              <span>{segment.label}</span>
              <span className="font-medium tabular-nums">{formatMoney(segment.amount)}</span>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
    </TooltipProvider>
  )
}
