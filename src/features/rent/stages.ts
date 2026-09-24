import type { RentStageKey, RentStatus } from '@/mock/types'

/**
 * Модель п'яти макроетапів — порт `features/rents/lifecycle/stages.ts` з CRM,
 * без lingui (прототип моногомовний, рядки українською в коді).
 *
 * Оренда живе як **5 макроетапів**; вісім системних статусів лежать під ними.
 * Степер — хребет для менеджера, статус — точний підстан.
 */

export interface RentStageDef {
  key: RentStageKey
  label: string
  /** Коротка підпис для вузьких рейлів. */
  short: string
}

export const RENT_STAGES: RentStageDef[] = [
  { key: 'draft', label: 'Оформлення', short: 'Оформлення' },
  { key: 'payment', label: 'Оплата', short: 'Оплата' },
  { key: 'handover', label: 'Видача', short: 'Видача' },
  { key: 'active', label: 'В роботі', short: 'В роботі' },
  { key: 'closing', label: 'Повернення і закриття', short: 'Закриття' },
]

/** Місце етапу на хребті (`-1`, якщо етап невідомий). */
export function rentStageIndex(key: RentStageKey): number {
  return RENT_STAGES.findIndex((s) => s.key === key)
}

const STATUS_TO_STAGE: Record<RentStatus, RentStageKey> = {
  DRAFT: 'draft',
  PENDING_PAYMENT: 'payment',
  PENDING_HANDOVER: 'handover',
  ACTIVE: 'active',
  EXPIRING_SOON: 'active',
  OVERDUE: 'active',
  AWAITING_CLOSURE: 'closing',
  CLOSED: 'closing',
}

export function rentStageForStatus(status: RentStatus): RentStageKey {
  return STATUS_TO_STAGE[status]
}

/** Підпис бейджа статусу в хедері. */
export function statusLabel(status: RentStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Чернетка'
    case 'PENDING_PAYMENT':
      return 'Очікує оплати'
    case 'PENDING_HANDOVER':
      return 'Очікує видачі'
    case 'ACTIVE':
      return 'В роботі'
    case 'EXPIRING_SOON':
      return 'Скоро повернення'
    case 'OVERDUE':
      return 'Прострочення'
    case 'AWAITING_CLOSURE':
      return 'Прийнято — чекає закриття'
    case 'CLOSED':
      return 'Закрита'
  }
}
