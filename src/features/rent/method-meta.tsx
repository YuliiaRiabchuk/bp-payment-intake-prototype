import { Banknote, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import type { MethodKind } from '@/mock/types'

/**
 * Словник способів оплати — той самий, що в CRM (`method-meta.tsx`):
 * іконка, підпис, тон плитки. Тон — грошовий, а не декоративний: готівка
 * зелена, безготівка синя, внутрішній залік фіолетовий.
 */
export type MoneyTone = 'cash' | 'cashless' | 'internal'

export const MONEY_TONE_SOFT: Record<MoneyTone, string> = {
  cash: 'bg-success-soft text-success-fg',
  cashless: 'bg-accent-soft text-accent-fg',
  internal: 'bg-violet-soft text-violet-fg',
}

export interface MethodMeta {
  label: string
  short: string
  icon: LucideIcon
  tone: MoneyTone
  /** Питання про призначення: «Каса», «Рахунок отримувача», «Термінал». */
  destLabel: string | null
}

export const METHOD_META: Record<MethodKind, MethodMeta> = {
  cash: { label: 'Готівка', short: 'Готівка', icon: Banknote, tone: 'cash', destLabel: 'Каса' },
  terminal: { label: 'Термінал', short: 'Термінал', icon: CreditCard, tone: 'cashless', destLabel: 'Термінал' },
  bank: {
    label: 'Банківський переказ',
    short: 'Переказ',
    icon: Landmark,
    tone: 'cashless',
    destLabel: 'Рахунок отримувача',
  },
  balance: {
    label: 'Рахунок контрагента',
    short: 'З балансу',
    icon: Wallet,
    tone: 'internal',
    destLabel: null,
  },
}

export function MethodTile({ method, size = 'md' }: { method: MethodKind; size?: 'sm' | 'md' }) {
  const meta = METHOD_META[method]
  const Icon = meta.icon
  return (
    <span
      className={
        (size === 'md' ? 'size-7 ' : 'size-6 ') +
        'grid shrink-0 place-items-center rounded-md ' +
        MONEY_TONE_SOFT[meta.tone]
      }
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  )
}
