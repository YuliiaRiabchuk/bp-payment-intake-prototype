/**
 * Реєстр варіантів. Крок «Прийом коштів» і правий сайдбар — дві незалежні
 * осі: будь-який варіант кроку поєднується з будь-яким варіантом сайдбару.
 *
 * Варіант 0 — порт чинного проду за кадрами `reference/`. Він антиреференс і
 * база для вимірів, тому стоїть першим і не зникає.
 */
export interface VariantDef {
  code: string
  label: string
  /** Одне речення: що ця композиція робить інакше. */
  note: string
}

export const STEP_VARIANTS: VariantDef[] = [
  { code: '0', label: 'Чинний прод', note: 'порт кадрів 1–12, антиреференс і база вимірів' },
]

export const RAIL_VARIANTS: VariantDef[] = [
  { code: '0', label: 'Чинний прод', note: 'картки рахунків і контрагента, як у CRM' },
]

export type Role = 'manager' | 'head'

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'Менеджер',
  head: 'Керівник',
}
