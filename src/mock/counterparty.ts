import type { Rent } from './types'

/**
 * Контрагент за межами поточної оренди — заглушки.
 *
 * Дві речі, яких немає в самій оренді, але без яких менеджер не розуміє, з
 * ким має справу: інші оренди цього клієнта і підсумок співпраці. Дані
 * вигадані навмисно і послідовно: суми інших оренд сходяться з підсумком,
 * інакше кадр брехав би на власному прикладі.
 */

export interface OtherRent {
  id: string
  displayCode: string
  /** Що взяв — одним рядком, без розкриття складу. */
  what: string
  period: string
  /** Стан оренди простими словами: менеджеру не потрібен код статусу. */
  state: 'active' | 'overdue' | 'closed'
  /** Борг по цій оренді. Нуль означає «розрахунок закритий». */
  debt: number
  total: number
}

export interface CounterpartyProfile {
  /** Скільки оренд і на яку суму — рядок, який просив бізнес. */
  rentsCount: number
  rentsTotal: number
  since: string
  /** Борг по ВСІХ орендах, включно з поточною. */
  debtTotal: number
  /** Депозити, які ще лежать у компанії по всіх активних орендах. */
  depositHeld: number
  others: OtherRent[]
}

const PROFILES: Record<string, CounterpartyProfile> = {
  // ФО з поточної сцени. Дві закриті оренди позаду, одна активна поруч.
  'cp-fl': {
    rentsCount: 5,
    rentsTotal: 41_800,
    since: 'березня 2024',
    debtTotal: 0,
    depositHeld: 5_000,
    others: [
      {
        id: 'r-fl-2',
        displayCode: 'АР-2М104',
        what: 'Бетонозмішувач 180 л',
        period: '12.08 — 16.08',
        state: 'closed',
        debt: 0,
        total: 3_200,
      },
      {
        id: 'r-fl-3',
        displayCode: 'АР-9C557',
        what: 'Перфоратор Bosch GBH — 2 шт',
        period: '02.07 — 09.07',
        state: 'closed',
        debt: 0,
        total: 5_600,
      },
    ],
  },
  // ЮО: довгий клієнт із паралельними орендами на різних обʼєктах.
  'cp-ul': {
    rentsCount: 23,
    rentsTotal: 1_284_000,
    since: 'лютого 2023',
    debtTotal: 12_400,
    depositHeld: 46_000,
    others: [
      {
        id: 'r-ul-2',
        displayCode: 'АР-3F218',
        what: 'Риштування рамні — обʼєкт Оболонь',
        period: '01.08 — 30.09',
        state: 'active',
        debt: 0,
        total: 96_000,
      },
      {
        id: 'r-ul-3',
        displayCode: 'АР-8B740',
        what: 'Опалубка стінова, комплект',
        period: '14.07 — 20.08',
        state: 'overdue',
        debt: 12_400,
        total: 148_000,
      },
      {
        id: 'r-ul-4',
        displayCode: 'АР-1K093',
        what: 'Вібротрамбівка VT-70',
        period: '03.06 — 28.06',
        state: 'closed',
        debt: 0,
        total: 21_000,
      },
    ],
  },
}

export function profileOf(rent: Rent): CounterpartyProfile {
  const base = PROFILES[rent.counterparty.kind === 'UL' ? 'cp-ul' : 'cp-fl']
  // Мінус на рахунку контрагента — це і є борг, і підсумок «Борг по всіх
  // орендах» не може казати «закрито» просто тому, що профіль зашитий
  // окремо від оренди. За три рядки одне від одного стояло «Борг на
  // рахунку: 3 400 грн» і «Борг по всіх орендах: закрито».
  const wallet = rent.counterparty.operationalBalance
  if (wallet >= 0) return base
  return { ...base, debtTotal: Math.max(base.debtTotal, Math.abs(wallet)) }
}

export const STATE_LABEL: Record<OtherRent['state'], string> = {
  active: 'В роботі',
  overdue: 'Прострочена',
  closed: 'Закрита',
}
