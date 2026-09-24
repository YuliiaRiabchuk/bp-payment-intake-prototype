import { createContext, useContext } from 'react'
import type { Charge } from '@/mock/types'

/**
 * Дії рівня картки, спільні для кроку і сайдбару будь-якого варіанта.
 *
 * Вхід «+ Додати нарахування / знижку» у сайдбарі веде на крок оплати з уже
 * розгорнутою формою (§5): форма одна, її стан живе тут, а не в сайдбарі.
 */
export interface CardActions {
  chargeForm: Charge['kind'] | null
  openChargeForm: (kind: Charge['kind']) => void
  closeChargeForm: () => void
  openChronology: () => void
  /**
   * Сума, яку менеджер зараз вводить у кроці. Сайдбар показує стан «після
   * прийому» з того самого розрахунку (§7). `null` — нічого не вводять.
   */
  pendingAmount: number | null
  setPendingAmount: (v: number | null) => void
  /** Сайдбар забирає «скільки ще прийняти» собі (варіант R-C). */
  railOwnsRemaining: boolean
}

export const CardContext = createContext<CardActions | null>(null)

export function useCard(): CardActions {
  const ctx = useContext(CardContext)
  if (!ctx) throw new Error('useCard must be used inside RentCard')
  return ctx
}
