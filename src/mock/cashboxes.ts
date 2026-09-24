import type { Cashbox } from './types'

/**
 * Довідник кас: 49 записів, як у чинному пошуку (кадр 3). Усі назви ФОПів,
 * IBAN і номери — заглушки (§11 брифу).
 *
 * Готівкова каса персональна: у неї приймає тільки її власник-менеджер.
 * Термінал у мережі один — на Куренівці. Безготівкові рахунки спільні.
 */

export const MANAGER = { id: 'm-1', name: 'Ірина Мельник', initials: 'ІМ' }

/** Фіктивний IBAN: UA + 2 цифри + МФО 305299 + 19 цифр. */
function iban(seed: number): string {
  const tail = String(26000000000000000000n + BigInt(seed) * 7919n).slice(-19)
  const check = String(10 + (seed * 37) % 89).padStart(2, '0')
  return `UA${check}305299${tail}`
}

const FOPS = [
  'ФОП Литвин Олена Іванівна',
  'ФОП Гребенюк Сергій Петрович',
  'ФОП Савчук Тарас Олегович',
  'ФОП Дорошенко Ніна Василівна',
  'ФОП Кравець Андрій Миколайович',
  'ФОП Остапчук Ірина Богданівна',
  'ФОП Мельничук Павло Романович',
  'ФОП Бондар Оксана Юріївна',
  'ФОП Ярошенко Віктор Степанович',
  'ФОП Панченко Людмила Олексіївна',
]

/** Відділення з однією готівковою касою. Куренівка — відділення оренди. */
const BRANCHES = [
  'Антоновича', 'Позняки', 'Оболонь', 'Троєщина', 'Виноградар', 'Теремки',
  'Борщагівка', 'Дарниця', 'Лісовий', 'Русанівка', 'Святошин', 'Бровари',
  'Ірпінь', 'Бориспіль', 'Вишневе', 'Біла Церква', 'Житомир', 'Одеса, Таїрова',
  'Одеса, Черемушки', 'Одеса, Пересип', 'Дніпро, Центр', 'Дніпро, Лівобережний',
  'Львів, Сихів', 'Львів, Левандівка', 'Харків, Салтівка', 'Вінниця', 'Полтава',
  'Черкаси', 'Чернігів', 'Суми', 'Рівне', 'Луцьк', 'Тернопіль', 'Хмельницький',
  'Кропивницький', 'Миколаїв', 'Запоріжжя', 'Херсон', 'Ужгород',
  'Івано-Франківськ', 'Чернівці', 'Кременчук',
]

export const RENT_BRANCH = 'Куренівка'

/** Довга назва ФОПа — крайній стан (§10). */
export const LONG_FOP = 'ФОП Олександренко-Ковальчук Анастасія-Марія Володимирівна'

export const ORG_TOV = 'ТОВ «Прокат-Сервіс Україна»'

export const CASHBOXES: Cashbox[] = [
  // Відділення оренди: дві каси менеджерів і термінал.
  {
    id: 'cb-kur-1',
    name: 'Каса Куренівка',
    kind: 'cash',
    org: FOPS[0],
    orgKind: 'fop',
    iban: iban(1),
    branch: RENT_BRANCH,
    ownerId: MANAGER.id,
  },
  {
    id: 'cb-kur-2',
    name: 'Каса Куренівка-2',
    kind: 'cash',
    org: FOPS[1],
    orgKind: 'fop',
    iban: iban(2),
    branch: RENT_BRANCH,
    ownerId: 'm-2',
  },
  {
    id: 'cb-term',
    name: 'Термінал Куренівка',
    kind: 'terminal',
    org: FOPS[0],
    orgKind: 'fop',
    iban: iban(3),
    branch: RENT_BRANCH,
  },
  // Безготівка: розрахунковий рахунок юрособи і рахунки ФОПів.
  {
    id: 'cb-org',
    name: 'Розрахунковий рахунок ТОВ',
    kind: 'bank',
    org: ORG_TOV,
    orgKind: 'tov',
    iban: iban(4),
    branch: null,
    orgAccount: true,
  },
  {
    id: 'cb-bank-1',
    name: 'Рахунок ФОП Литвин',
    kind: 'bank',
    org: FOPS[0],
    orgKind: 'fop',
    iban: iban(5),
    branch: null,
  },
  {
    id: 'cb-bank-2',
    name: 'Рахунок ФОП Гребенюк',
    kind: 'bank',
    org: FOPS[1],
    orgKind: 'fop',
    iban: iban(6),
    branch: null,
  },
  {
    id: 'cb-bank-long',
    name: 'Рахунок ФОП Олександренко-Ковальчук',
    kind: 'bank',
    org: LONG_FOP,
    orgKind: 'fop',
    iban: iban(7),
    branch: null,
  },
  // Інші відділення: по одній персональній касі.
  ...BRANCHES.map<Cashbox>((b, i) => ({
    id: `cb-${i + 10}`,
    name: `Каса ${b}`,
    kind: 'cash',
    org: FOPS[(i + 2) % FOPS.length],
    orgKind: 'fop',
    iban: iban(i + 10),
    branch: b,
    ownerId: `m-${i + 10}`,
  })),
]

export const CASHBOX_BY_ID = new Map(CASHBOXES.map((c) => [c.id, c]))

export function cashboxOf(id: string | null | undefined): Cashbox | undefined {
  return id ? CASHBOX_BY_ID.get(id) : undefined
}

/** «UA••••3818» — як у рядку способу. */
export function shortIban(value: string): string {
  return `UA••••${value.slice(-4)}`
}

/** «UA86 3052 9900 …» — повний, групами по 4. */
export function fullIban(value: string): string {
  return value.replace(/(.{4})/g, '$1 ').trim()
}
