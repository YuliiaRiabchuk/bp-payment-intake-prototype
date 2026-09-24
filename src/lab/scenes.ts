import type { Action } from '@/state/rent-store'
import type { RentId } from '@/mock/rents'
import type { RentStageKey } from '@/mock/types'

/**
 * Дванадцять сцен §8 брифу як стан, а не як опис. Кожна — набір дій над
 * стором: обрав сцену, і екран уже в потрібному стані, далі клікаєш руками.
 *
 * Сцена живе НАД варіантами. Перемикання варіанта її не чіпає, інакше
 * варіанти нема з чим порівнювати.
 *
 * Етап 0: назви і призначення сцен. Стани (`setup`) заповнює етап 2 разом
 * із моками прийому коштів.
 */
export interface Scene {
  id: string
  n: number
  title: string
  rent: RentId
  stage: RentStageKey
  /** Що ця сцена має довести. */
  proves: string
  setup: (rent: RentId) => Action[]
}

export const SCENES: Scene[] = [
  {
    id: 'queue',
    n: 1,
    title: 'Черга',
    rent: 'fl',
    stage: 'payment',
    proves: 'фізособа, готівка на всю суму в касу менеджера; міряємо кліки',
    setup: () => [],
  },
  {
    id: 'split',
    n: 2,
    title: 'Поділ',
    rent: 'fl',
    stage: 'payment',
    proves: 'оренда готівкою, застава терміналом; видно, що закрив кожен платіж',
    setup: () => [],
  },
  {
    id: 'transfer-fl',
    n: 3,
    title: 'Переказ фізособи',
    rent: 'fl',
    stage: 'payment',
    proves: 'реквізити, квитанція, підтвердження, ПКО; рахунок на оплату на прохання',
    setup: () => [],
  },
  {
    id: 'legal',
    n: 4,
    title: 'Юрособа',
    rent: 'ul',
    stage: 'payment',
    proves: 'два рахунки на оплату, повернення наступного дня, недоплата з 1С',
    setup: () => [],
  },
  {
    id: 'charge-after',
    n: 5,
    title: 'Нарахування після оплати',
    rent: 'fl',
    stage: 'payment',
    proves: 'доставка 1 000 після повної оплати: окремий платіж тільки на нарахування',
    setup: () => [],
  },
  {
    id: 'partial',
    n: 6,
    title: 'Часткова оплата',
    rent: 'fl',
    stage: 'payment',
    proves: 'внесено 3 000 з 5 100: менеджер іде до видачі сам; без оплати не проходить',
    setup: () => [],
  },
  {
    id: 'balance',
    n: 7,
    title: 'Оплата балансом',
    rent: 'fl',
    stage: 'payment',
    proves: 'гаманець +1 500 закриває частину оренди, решта готівкою',
    setup: () => [],
  },
  {
    id: 'reversal',
    n: 8,
    title: 'Помилка каси',
    rent: 'fl',
    stage: 'payment',
    proves: 'сторно з хронології, новий спосіб, обидва записи з ПІБ і часом',
    setup: () => [],
  },
  {
    id: 'zero-deposit',
    n: 9,
    title: 'Застава 0',
    rent: 'fl',
    stage: 'payment',
    proves: 'заставу вдруге не беруть: блокуючий діалог на переході до видачі',
    setup: () => [],
  },
  {
    id: 'from-1c',
    n: 10,
    title: 'Дані з 1С',
    rent: 'fl',
    stage: 'payment',
    proves: 'ПКО з 1С з позначкою джерела поруч із власним, що чекає номер',
    setup: () => [],
  },
  {
    id: 'discount',
    n: 11,
    title: 'Знижка після оплати',
    rent: 'fl',
    stage: 'payment',
    proves: 'знижка 500 дає переплату, сайдбар показує суму до повернення',
    setup: () => [],
  },
  {
    id: 'big',
    n: 12,
    title: 'Велика оренда',
    rent: 'fl',
    stage: 'payment',
    proves: 'чотири позиції, комплект, доставка і хімія; склад суми без «Оформлення»',
    setup: () => [],
  },
]

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]))

export const STAGE_LABELS: { key: RentStageKey; label: string }[] = [
  { key: 'draft', label: 'Оформлення' },
  { key: 'payment', label: 'Оплата' },
  { key: 'handover', label: 'Видача' },
  { key: 'active', label: 'В роботі' },
  { key: 'closing', label: 'Закриття' },
]
