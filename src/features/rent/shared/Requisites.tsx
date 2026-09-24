import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { fullIban } from '@/mock/cashboxes'
import type { Cashbox, Rent } from '@/mock/types'

/**
 * Реквізити для переказу: отримувач, повний IBAN, призначення, «скопіювати»
 * і QR НБУ. Порт `RequisitesCard` + `PaymentQr` з CRM. QR тут — візерунок-
 * заглушка з тих самих даних: у прототипі його не сканують.
 */

export function purposeOf(rent: Rent, kind: 'rent' | 'deposit' = 'rent'): string {
  const ref = 'BP-G9HV86KPQ3'
  return kind === 'deposit'
    ? `${ref} Заставний платіж за оренду обладнання, оренда ${rent.code}`
    : `${ref} Оплата за оренду обладнання, оренда ${rent.code}`
}

function useCopy() {
  const [done, setDone] = useState<string | null>(null)
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* буфер недоступний — показуємо успіх однаково, текст видно на екрані */
    }
    setDone(key)
    window.setTimeout(() => setDone((k) => (k === key ? null : k)), 1400)
  }
  return { done, copy }
}

export function Requisites({
  box,
  amount,
  purpose,
  compact,
  className,
}: {
  box: Cashbox
  amount: number
  purpose: string
  /** Без QR — для вузької колонки. */
  compact?: boolean
  className?: string
}) {
  const { done, copy } = useCopy()
  const all = `Отримувач: ${box.org}\nIBAN: ${fullIban(box.iban)}\nСума: ${formatMoney(amount)}\nПризначення: ${purpose}`
  const rows: [string, string, string][] = [
    ['org', 'Отримувач', box.org],
    ['iban', 'IBAN', fullIban(box.iban)],
    ['purpose', 'Призначення', purpose],
  ]
  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="requisites">
      <div className="flex items-center justify-between gap-2">
        <span className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
          Реквізити для оплати
        </span>
        <button
          type="button"
          onClick={() => copy('all', all)}
          className="inline-flex items-center gap-1.5 rounded-sm px-1 text-label text-fg-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
          data-testid="copy-all"
        >
          {done === 'all' ? <Check className="size-3.5 text-success-fg" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {done === 'all' ? 'Скопійовано' : 'Скопіювати все'}
        </button>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        {rows.map(([key, label, value]) => (
          <div key={key} className="contents">
            <dt className="pt-px text-label text-muted-fg">{label}</dt>
            <dd className={cn('min-w-0 break-words text-body text-fg', key === 'iban' && 'tabular-nums')}>{value}</dd>
            <button
              type="button"
              onClick={() => copy(key, value)}
              aria-label={`Скопіювати: ${label}`}
              className="grid size-5 place-items-center rounded-sm text-subtle hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
            >
              {done === key ? <Check className="size-3 text-success-fg" aria-hidden /> : <Copy className="size-3" aria-hidden />}
            </button>
          </div>
        ))}
      </dl>
      {!compact && (
        <div className="flex items-center gap-3">
          <FakeQr seed={all} />
          <p className="text-label text-muted-fg">
            Клієнт може відсканувати код у застосунку свого банку — реквізити, сума та призначення підставляться самі.
          </p>
        </div>
      )}
    </div>
  )
}

/** Детермінований візерунок 25×25 з кутовими маркерами. Не справжній QR. */
export function FakeQr({ seed, size = 96 }: { seed: string; size?: number }) {
  const n = 25
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const bit = (x: number, y: number) => {
    let v = h ^ Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)
    v = Math.imul(v ^ (v >>> 13), 1274126177)
    return ((v >>> 16) & 1) === 1
  }
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => {
      const dx = x - ox
      const dy = y - oy
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
      return ring !== 2
    }
    return inBox(0, 0) ?? inBox(n - 7, 0) ?? inBox(0, n - 7)
  }
  const cells: string[] = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y)
      if (f === true || (f === null && bit(x, y))) cells.push(`M${x} ${y}h1v1h-1z`)
    }
  return (
    <svg
      viewBox={`-1 -1 ${n + 2} ${n + 2}`}
      width={size}
      height={size}
      className="shrink-0 rounded-sm border border-border bg-white"
      role="img"
      aria-label="QR-код для оплати"
      shapeRendering="crispEdges"
    >
      <path d={cells.join('')} fill="currentColor" className="text-fg" />
    </svg>
  )
}
