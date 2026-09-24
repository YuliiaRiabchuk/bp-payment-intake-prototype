import type { SceneId } from '@/mock/rents'
import type { Party, StageKey } from '@/mock/types'

/**
 * Дванадцять сцен §8 брифу як стан, а не як опис. Дані кожної сцени
 * збирає `buildRent(id, party)`: обрав сцену, і екран уже в потрібному
 * стані, далі клікаєш руками.
 *
 * Сцена живе НАД варіантами: той самий стан для 0, A, B, C, D, інакше
 * варіанти нема з чим порівнювати. `party` — контрагент за замовчуванням;
 * перемикач у віджеті дає ту саму сцену для іншого.
 */
export interface Scene {
  id: SceneId
  n: number
  title: string
  party: Party
  stage: StageKey
  /** Що ця сцена має довести. */
  proves: string
}

export const SCENES: Scene[] = [
  {
    id: 'queue',
    n: 1,
    title: 'Черга',
    party: 'fl',
    stage: 'payment',
    proves: 'фізособа, готівка на всю суму в касу менеджера; міряємо кліки',
  },
  {
    id: 'split',
    n: 2,
    title: 'Поділ',
    party: 'fl',
    stage: 'payment',
    proves: 'оренда готівкою, застава терміналом; видно, що закрив кожен платіж',
  },
  {
    id: 'transfer-fl',
    n: 3,
    title: 'Переказ фізособи',
    party: 'fl',
    stage: 'payment',
    proves: 'реквізити, квитанція, підтвердження, ПКО; рахунок на оплату на прохання',
  },
  {
    id: 'legal',
    n: 4,
    title: 'Юрособа',
    party: 'ul',
    stage: 'payment',
    proves: 'два рахунки на оплату, повернення наступного дня, недоплата з 1С',
  },
  {
    id: 'charge-after',
    n: 5,
    title: 'Нарахування після оплати',
    party: 'fl',
    stage: 'payment',
    proves: 'доставка 1 000 після повної оплати: окремий платіж тільки на нарахування',
  },
  {
    id: 'partial',
    n: 6,
    title: 'Часткова оплата',
    party: 'fl',
    stage: 'payment',
    proves: 'внесено 3 000 з 5 100: менеджер іде до видачі сам; без оплати не проходить',
  },
  {
    id: 'balance',
    n: 7,
    title: 'Оплата балансом',
    party: 'fl',
    stage: 'payment',
    proves: 'гаманець +1 500 закриває частину оренди, решта готівкою',
  },
  {
    id: 'reversal',
    n: 8,
    title: 'Помилка каси',
    party: 'fl',
    stage: 'payment',
    proves: 'сторно з хронології, новий спосіб, обидва записи з ПІБ і часом',
  },
  {
    id: 'zero-deposit',
    n: 9,
    title: 'Застава 0',
    party: 'fl',
    stage: 'payment',
    proves: 'заставу вдруге не беруть: блокуючий діалог на переході до видачі',
  },
  {
    id: 'from-1c',
    n: 10,
    title: 'Дані з 1С',
    party: 'fl',
    stage: 'payment',
    proves: 'ПКО з 1С з позначкою джерела поруч із власним, що чекає номер',
  },
  {
    id: 'discount',
    n: 11,
    title: 'Знижка після оплати',
    party: 'fl',
    stage: 'payment',
    proves: 'знижка 500 дає переплату, сайдбар показує суму до повернення',
  },
  {
    id: 'big',
    n: 12,
    title: 'Велика оренда',
    party: 'fl',
    stage: 'payment',
    proves: 'чотири позиції, комплект, доставка і хімія; склад суми без «Оформлення»',
  },
]

export const SCENE_BY_ID = new Map<string, Scene>(SCENES.map((s) => [s.id, s]))

export const STAGE_LABELS: { key: StageKey; label: string }[] = [
  { key: 'draft', label: 'Оформлення' },
  { key: 'payment', label: 'Оплата' },
  { key: 'handover', label: 'Видача' },
  { key: 'active', label: 'В роботі' },
  { key: 'closing', label: 'Закриття' },
]
