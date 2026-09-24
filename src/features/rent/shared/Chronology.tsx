import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { History, Undo2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { useStore } from '@/state/store'
import type { Payment, Rent } from '@/mock/types'

/**
 * Хронологія оренди — бокова панель із шапки.
 *
 * Тут і тільки тут скасовують прийом (§5): у зворотному порядку, спершу
 * найсвіжіший платіж. Скасування — сторно: ПКО отримує «Анульований», у
 * хронології лишаються обидва записи з ПІБ і часом. Платежі з 1С і
 * проведені бухгалтером тут не скасовуються — лише пояснюється чому.
 */

export function annulBlockReason(rent: Rent, p: Payment): string | null {
  if (p.annulled) return 'Уже анульовано'
  if (rent.handedOver) return 'Спершу скасуйте видачу'
  if (p.source === '1c') return 'Заведено в 1С — скасовує бухгалтер'
  if (p.booked1c) return 'Проведено бухгалтером у 1С — скасовує бухгалтер'
  const live = rent.payments.filter((x) => !x.annulled && x.source === 'crm' && !x.booked1c)
  const latest = live[live.length - 1]
  if (latest && latest.id !== p.id) return 'Скасовують у зворотному порядку: спершу пізніший платіж'
  return null
}

export function Chronology({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rent, dispatch } = useStore()
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const events = [...rent.events].reverse()

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="chronology">
      <button type="button" aria-label="Закрити хронологію" className="absolute inset-0 bg-fg/20" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Хронологія оренди"
        className="relative flex h-full w-[26rem] max-w-full flex-col border-l border-border bg-card shadow-dialog animate-in slide-in-from-right-4 fade-in-0 duration-200 motion-reduce:animate-none"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <History className="size-4 text-muted-fg" aria-hidden />
          <h2 className="text-title font-semibold">Хронологія</h2>
          <span className="font-mono text-mono text-muted-fg">{rent.code}</span>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose} aria-label="Закрити">
            <X className="size-4" />
          </Button>
        </header>
        <ol className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {events.length === 0 && <li className="py-6 text-center text-body text-muted-fg">Подій ще не було</li>}
          {events.map((e) => {
            const p = e.kind === 'payment' ? rent.payments.find((x) => x.id === e.paymentId) : undefined
            const block = p ? annulBlockReason(rent, p) : null
            const annulled = p?.annulled
            return (
              <li key={e.id} className="relative border-l border-border pb-4 pl-4 last:pb-0" data-event={e.kind}>
                <span
                  className={cn(
                    'absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-card',
                    e.kind === 'annul' || e.kind === 'charge-cancel' || e.kind === 'invoice-cancel'
                      ? 'bg-danger'
                      : e.kind === 'payment'
                        ? 'bg-success'
                        : 'bg-border-strong',
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-label tabular-nums text-muted-fg">{e.at}</span>
                  <span className="text-label text-fg-2">{e.who}</span>
                  {e.source === '1c' && <Badge variant="outline">1С</Badge>}
                </div>
                <p className={cn('mt-0.5 text-body text-fg', annulled && 'text-muted-fg line-through')}>{e.text}</p>
                {p && !annulled && (
                  <div className="mt-1.5">
                    {confirming === p.id ? (
                      <div className="rounded-md border border-danger/30 bg-danger-soft/40 p-2.5" data-testid="annul-confirm">
                        <p className="text-body text-fg">
                          Сторнувати {formatMoney(p.amount)}? {p.doc ? `ПКО отримає статус «Анульований». ` : ''}
                          Сума повернеться в борг за орендою, обидва записи лишаться в хронології.
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                            Не скасовувати
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            data-testid="annul-submit"
                            onClick={() => {
                              dispatch({ type: 'ANNUL', paymentId: p.id })
                              setConfirming(null)
                            }}
                          >
                            Сторнувати
                          </Button>
                        </div>
                      </div>
                    ) : block ? (
                      <p className="text-label text-muted-fg">{block}</p>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="-ml-2 text-danger-fg"
                        onClick={() => setConfirming(p.id)}
                        data-testid={`annul-${p.id}`}
                      >
                        <Undo2 className="size-3.5" aria-hidden />
                        Сторнувати прийом
                      </Button>
                    )}
                  </div>
                )}
                {p?.annulled && (
                  <p className="mt-0.5 text-label text-danger-fg">
                    Анульовано — {p.annulled.by}, {p.annulled.at}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </aside>
    </div>,
    document.body,
  )
}
