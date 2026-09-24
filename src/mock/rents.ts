import type { Rent } from './types'

/**
 * Дві оренди прототипу — два входи в ОДИН екран, не два екрани. Усі реквізити
 * заглушки (BRIEF §10): імена, телефони, ЄДРПОУ і номери документів вигадані,
 * суми повторюють референсний кадр.
 *
 *  - `fl` — фізособа за стійкою, готівка, прострочення на дві доби. Це кадр
 *    `reference/02-stage-active.png`: верстат 600 грн/доба, рахунок оренди
 *    600 грн (1 200 мінус знижка 600), застава 5 000 грн, обидва закриті одним
 *    ПКО на 5 600 грн. Несе системний рядок прострочення — сцена §7.5.
 *  - `ul` — юрособа віддалено, безготівка з ПДВ, оренда триває штатно і БЕЗ
 *    жодного нарахування. Це сцена §7.6: порожній стан, секції не існує.
 */

const FL: Rent = {
  id: 'fl',
  displayCode: 'АР-4Н383',
  externalId1c: '1С: №00-000174',
  status: 'OVERDUE',
  stage: 'active',
  maxStage: 'active',
  cashbox: 'Каса Позняки',
  counterparty: {
    id: 'cp-fl',
    kind: 'FL',
    name: 'Коваленко Андрій Сергійович',
    phone: '+380 67 000-11-22',
    operationalBalance: 0,
    depositBalance: 5000,
  },
  manager: { initials: 'ВО', name: 'Володимир Омелич' },
  branch: 'Позняки',
  issueAt: '26.08',
  plannedReturnAt: '28.08',
  currentDay: 5,
  plannedDays: 2,
  positions: [
    {
      id: 'p-1',
      name: 'Верстат для згинання арматури SUB25 S',
      qty: 1,
      pricePerDay: 600,
      accepted: false,
    },
  ],
  rentInvoice: {
    kind: 'rent',
    total: 600,
    paid: 600,
    lines: [
      { id: 'l-1', label: 'Оренда обладнання', amount: 1200, kind: 'base' },
      { id: 'l-2', label: 'Знижка', amount: -600, kind: 'discount' },
    ],
  },
  depositInvoice: {
    kind: 'deposit',
    total: 5000,
    paid: 5000,
    lines: [
      { id: 'l-3', label: 'Застава за обладнання', amount: 5000, kind: 'base' },
    ],
  },
  payments: [
    {
      id: 'pay-1',
      method: 'cash',
      cashbox: 'Каса Позняки',
      status: 'confirmed',
      amount: 5600,
      document: 'ПКО-000174',
      purpose: 'Оренда 600 грн + Застава 5 000 грн',
      allocation: { rent: 600, deposit: 5000 },
      at: '26.08, 14:58',
    },
  ],
  documents: [
    { id: 'd-1', name: 'Договір з ФОП складу', number: 'A00188726', date: '15.07' },
    {
      id: 'd-2',
      name: 'Акт приймання-передачі',
      number: 'ЛА0000011',
      date: '26.08',
      signed: false,
    },
    { id: 'd-3', name: 'Акт повернення', pending: true },
    { id: 'd-4', name: 'Складський акт', pending: true },
    { id: 'd-5', name: 'ТТН', pending: true },
  ],
  surcharges: [
    /* Сцена §7.5. Прострочення нарахуванням НЕ оформлюється: рядок системний,
       статті витрат у нього немає, форма для нього не відкривається. Різниця
       між нарахованим по добах (5 × 600) і рахунком оренди (600) утримується
       із застави при поверненні. */
    {
      id: 's-overdue-fl',
      kind: 'overdue',
      positionId: 'p-1',
      amount: 2400,
      articleId: null,
      createdAt: '29.08, 09:00',
      source: 'system',
      status: 'withheld',
    },
  ],
}

const UL: Rent = {
  id: 'ul',
  displayCode: 'АР-7К921',
  externalId1c: '1С: №00-000208',
  status: 'ACTIVE',
  stage: 'active',
  maxStage: 'active',
  cashbox: 'Рахунок ТОВ — оренда',
  counterparty: {
    id: 'cp-ul',
    kind: 'UL',
    name: 'ТОВ «Будмонтаж-Плюс»',
    phone: '+380 44 000-00-00 — Петренко О. І.',
    edrpou: '00000000',
    operationalBalance: 0,
    depositBalance: 18000,
  },
  manager: { initials: 'ЮР', name: 'Юрій Рибалко' },
  branch: 'Куренівка',
  issueAt: '20.08',
  plannedReturnAt: '19.09',
  currentDay: 7,
  plannedDays: 30,
  positions: [
    {
      id: 'p-2',
      name: 'Риштування рамні, комплект 3×3 м',
      qty: 4,
      pricePerDay: 420,
      accepted: false,
    },
    {
      id: 'p-3',
      name: 'Віброплита реверсивна VP-160',
      qty: 1,
      pricePerDay: 900,
      accepted: false,
    },
  ],
  rentInvoice: {
    kind: 'rent',
    total: 74160,
    paid: 74160,
    vat: 'with',
    lines: [
      {
        id: 'l-4',
        // Найменування з 1С, а не скорочення для макета. Реквізит «послуга»
        // тягне повну назву номенклатури, і вона довга: обрізати її не можна
        // (в рахунку ЮО це юридично значущий рядок), тому інтерфейс має її
        // переносити, а не ховати.
        label:
          'Послуга оренди риштування рамні комплект 3×3 м оцинковані з настилом і драбиною',
        amount: 50400,
        kind: 'base',
      },
      {
        id: 'l-5',
        label:
          'Послуга оренди віброплита реверсивна VP-160 з гумовим килимком та транспортним візком',
        amount: 27000,
        kind: 'base',
      },
      { id: 'l-6', label: 'Знижка', amount: -3240, kind: 'discount' },
    ],
  },
  depositInvoice: {
    kind: 'deposit',
    total: 18000,
    paid: 18000,
    vat: 'without',
    lines: [
      { id: 'l-7', label: 'Застава за обладнання', amount: 18000, kind: 'base' },
    ],
  },
  payments: [
    {
      id: 'pay-2',
      method: 'bank',
      cashbox: 'Рахунок ТОВ — оренда',
      status: 'confirmed',
      amount: 74160,
      document: 'Рахунок СФ-000208',
      purpose: 'Оренда за договором, у т.ч. ПДВ 12 360 грн',
      at: '20.08, 11:12',
    },
    {
      id: 'pay-3',
      method: 'bank',
      cashbox: 'Рахунок ТОВ — застава',
      status: 'confirmed',
      amount: 18000,
      document: 'Рахунок СФ-000209',
      purpose: 'Гарантійний платіж, без ПДВ',
      at: '20.08, 11:14',
    },
  ],
  documents: [
    { id: 'd-6', name: 'Договір оренди', number: 'Д-000208', date: '19.08' },
    {
      id: 'd-7',
      name: 'Акт приймання-передачі',
      number: 'ЛА0000042',
      date: '20.08',
      signed: true,
    },
    { id: 'd-8', name: 'Рахунок на оплату', number: 'СФ-000208', date: '19.08' },
    { id: 'd-9', name: 'Акт повернення', pending: true },
  ],
  /* Сцена §7.6 — порожній стан. Жодного нарахування, отже секції на екрані
     немає взагалі: ні блока, ні місця під нього. */
  surcharges: [],
}

export const INITIAL_RENTS: Record<string, Rent> = { fl: FL, ul: UL }

export const RENT_IDS = ['fl', 'ul'] as const
export type RentId = (typeof RENT_IDS)[number]
