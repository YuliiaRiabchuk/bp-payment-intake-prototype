import { MANAGER, RENT_BRANCH } from './cashboxes'
import type { Charge, Counterparty, Party, Payment, PaymentInvoice, Position, Rent, RentEvent } from './types'

/**
 * Дані 12 сцен §8. Кожна сцена будується з однієї бази, тож варіанти
 * порівнюються на однакових грошах. Усі імена, телефони, ЄДРПОУ, номери —
 * заглушки (§11).
 *
 * Годинник сцен: «сьогодні» 24.09, менеджер відкриває оренду о 10:12.
 */

export const TODAY = '24.09'
export const YESTERDAY = '23.09'
const ACCOUNTANT = 'Бухгалтерія (1С)'

const SHURIK: Position = {
  id: 'p-1',
  name: 'Акум. шуруповерт BOSCH GSR 1440 LI',
  sku: 'НОМ-10186',
  kind: 'unit',
  qty: 1,
  days: 7,
  price: 300,
  deposit: 3000,
}

const BIG: Position[] = [
  {
    id: 'p-1',
    name: 'Перфоратор Makita HR2470',
    sku: 'НОМ-10412',
    kind: 'unit',
    qty: 1,
    days: 7,
    price: 350,
    deposit: 4000,
  },
  {
    id: 'p-2',
    name: 'Відбійний молоток Bosch GSH 11 VC',
    sku: 'НОМ-10977',
    kind: 'unit',
    qty: 1,
    days: 7,
    price: 600,
    deposit: 8000,
  },
  {
    id: 'p-3',
    name: 'Бур SDS-plus 12×260',
    sku: 'НОМ-20331',
    kind: 'consumable',
    qty: 4,
    days: null,
    price: 85,
    deposit: 0,
  },
  {
    id: 'p-4',
    name: 'Комплект для штукатурення',
    sku: 'КОМ-00318',
    kind: 'kit',
    qty: 1,
    days: 7,
    price: 250,
    deposit: 2500,
    parts: [
      { name: 'Міксер будівельний Einhell TC-MX 1400', qty: 1 },
      { name: 'Відро будівельне 30 л', qty: 2 },
      { name: 'Правило алюмінієве 2 м', qty: 1 },
    ],
  },
]

function flCounterparty(): Counterparty {
  return {
    name: 'Коваленко Андрій Сергійович',
    phone: '+380 67 000-11-22',
    requisitesOk: true,
    wallet: -10760,
    walletParts: [
      { code: 'АР-2К41М', amount: -6400, note: 'прострочення 8 діб' },
      { code: 'АР-31Д0Т', amount: -4360, note: 'доставка і миття' },
    ],
    depositBalance: 3000,
    depositParts: [{ code: 'АР-31Д0Т', amount: 3000 }],
    activeRents: 3,
  }
}

function ulCounterparty(): Counterparty {
  return {
    name: 'ТОВ «Будмонтаж-Приклад»',
    phone: '+380 44 000-22-33',
    edrpou: '12345678',
    requisitesOk: true,
    wallet: 0,
    walletParts: [],
    depositBalance: 0,
    depositParts: [],
    activeRents: 14,
  }
}

function base(party: Party): Rent {
  return {
    id: `rent-${party}`,
    code: 'АР-35Е7Р',
    party,
    counterparty: party === 'fl' ? flCounterparty() : ulCounterparty(),
    manager: MANAGER,
    branch: RENT_BRANCH,
    warehouse: 'Куренівка',
    issueAt: '24.09, 18:00',
    returnAt: '01.10, 18:00',
    positions: [SHURIK],
    charges: [],
    payments: [],
    invoices: [],
    drafts: [],
    events: [],
  }
}

const ev = (e: Omit<RentEvent, 'id'>, i: number): RentEvent => ({ id: `e-seed-${i}`, ...e })

function cashPayment(
  id: string,
  amount: number,
  cover: Payment['cover'],
  at: string,
  number: string | null,
  extra: Partial<Payment> = {},
): Payment {
  return {
    id,
    method: 'cash',
    cashboxId: 'cb-kur-1',
    amount,
    cover,
    at,
    by: MANAGER.name,
    doc: { number, auto1c: number == null ? false : true },
    source: 'crm',
    ...extra,
  }
}

const DELIVERY = (at: string, vatable = false): Charge => ({
  id: 'ch-delivery',
  kind: 'charge',
  article: 'Доставка',
  target: 'Уся оренда',
  net: 1000,
  vatable,
  createdAt: at,
  createdBy: MANAGER.name,
})

export type SceneId =
  | 'queue'
  | 'split'
  | 'transfer-fl'
  | 'legal'
  | 'charge-after'
  | 'partial'
  | 'balance'
  | 'reversal'
  | 'zero-deposit'
  | 'from-1c'
  | 'discount'
  | 'big'

/** Оренда в стані сцени для заданого контрагента. */
export function buildRent(scene: SceneId, party: Party): Rent {
  const r = base(party)
  const fl = party === 'fl'
  // Повна оплата «на вчора»: фізособа готівкою, юрособа двома переказами.
  const fullPaid = (): void => {
    if (fl) {
      r.payments = [
        cashPayment('pay-seed-1', 5100, { rent: 2100, deposit: 3000, charges: {} }, `${TODAY}, 09:40`, 'ПКО-000179'),
      ]
      r.events = [
        ev({ at: `${TODAY}, 09:40`, who: MANAGER.name, kind: 'payment', text: 'Прийнято 5 100 грн готівкою — Каса Куренівка', paymentId: 'pay-seed-1' }, 1),
        ev({ at: `${TODAY}, 09:40`, who: '1С', kind: 'number', text: 'Присвоєно № ПКО-000179', source: '1c' }, 2),
      ]
    } else {
      r.invoices = [ulInvoice('inv-seed-r', 'Р-000210', 'rent', 2520, 20), ulInvoice('inv-seed-d', 'Р-000211', 'deposit', 3000, 0)]
      r.payments = [
        bankPayment('pay-seed-r', 2520, { rent: 2520, deposit: 0, charges: {} }, `${YESTERDAY}, 16:40`, 'inv-seed-r'),
        bankPayment('pay-seed-d', 3000, { rent: 0, deposit: 3000, charges: {} }, `${YESTERDAY}, 16:41`, 'inv-seed-d'),
      ]
      r.events = [
        ev({ at: `${YESTERDAY}, 11:05`, who: MANAGER.name, kind: 'invoice', text: 'Сформовано рахунки на оплату Р-000210 (оренда 2 520 грн з ПДВ) і Р-000211 (застава 3 000 грн)' }, 1),
        ev({ at: `${YESTERDAY}, 16:40`, who: MANAGER.name, kind: 'payment', text: 'Підтверджено надходження 2 520 грн за квитанцією', paymentId: 'pay-seed-r' }, 2),
        ev({ at: `${YESTERDAY}, 16:41`, who: MANAGER.name, kind: 'payment', text: 'Підтверджено надходження 3 000 грн за квитанцією', paymentId: 'pay-seed-d' }, 3),
      ]
    }
  }

  switch (scene) {
    case 'queue':
    case 'split':
    case 'transfer-fl':
    case 'partial':
      break

    case 'legal': {
      if (fl) {
        // Фізособа: один рахунок на всю суму, підтверджено вчора, 1С провела менше.
        r.invoices = [
          {
            id: 'inv-seed-all',
            number: 'Р-000212',
            auto1c: true,
            createdAt: `${YESTERDAY}, 11:05`,
            createdBy: MANAGER.name,
            group: 'all',
            amount: 5100,
            vatRate: 0,
            lines: [
              { name: `Послуга оренди ${SHURIK.name}`, amount: 2100 },
              { name: `Заставний платіж за ${SHURIK.name}`, amount: 3000 },
            ],
          },
        ]
        r.payments = [
          {
            id: 'pay-seed-bank',
            method: 'bank',
            cashboxId: 'cb-bank-1',
            amount: 5100,
            cover: { rent: 2100, deposit: 3000, charges: {} },
            at: `${YESTERDAY}, 16:40`,
            by: MANAGER.name,
            doc: { number: 'ПКО-000177', auto1c: true },
            invoiceId: 'inv-seed-all',
            source: 'crm',
            booked1c: { amount: 4900, at: `${TODAY}, 09:05` },
          },
        ]
        r.events = [
          ev({ at: `${YESTERDAY}, 11:05`, who: MANAGER.name, kind: 'invoice', text: 'Сформовано рахунок на оплату Р-000212 на 5 100 грн' }, 1),
          ev({ at: `${YESTERDAY}, 16:40`, who: MANAGER.name, kind: 'payment', text: 'Підтверджено надходження 5 100 грн за квитанцією', paymentId: 'pay-seed-bank' }, 2),
          ev({ at: `${TODAY}, 09:05`, who: ACCOUNTANT, kind: 'booked', text: 'Платіжку проведено на 4 900 грн — недоплата 200 грн', source: '1c' }, 3),
        ]
      } else {
        // Юрособа: два рахунки вчора. Оренду менеджер підтвердив за
        // квитанцією, 1С провела менше. Застава ще чекає грошей.
        r.invoices = [ulInvoice('inv-seed-r', 'Р-000212', 'rent', 2520, 20), ulInvoice('inv-seed-d', 'Р-000213', 'deposit', 3000, 0)]
        r.payments = [
          {
            ...bankPayment('pay-seed-r', 2520, { rent: 2520, deposit: 0, charges: {} }, `${YESTERDAY}, 16:40`, 'inv-seed-r'),
            booked1c: { amount: 2400, at: `${TODAY}, 09:05` },
          },
        ]
        r.drafts = [
          { id: 'draft-seed-d', method: 'bank', cashboxId: 'cb-org', amount: 3000, target: 'deposit', invoiceId: 'inv-seed-d' },
        ]
        r.events = [
          ev({ at: `${YESTERDAY}, 11:05`, who: MANAGER.name, kind: 'invoice', text: 'Сформовано рахунки на оплату Р-000212 (оренда 2 520 грн з ПДВ) і Р-000213 (застава 3 000 грн)' }, 1),
          ev({ at: `${YESTERDAY}, 16:40`, who: MANAGER.name, kind: 'payment', text: 'Підтверджено надходження 2 520 грн за квитанцією', paymentId: 'pay-seed-r' }, 2),
          ev({ at: `${TODAY}, 09:05`, who: ACCOUNTANT, kind: 'booked', text: 'Платіжку за Р-000212 проведено на 2 400 грн — недоплата 120 грн', source: '1c' }, 3),
        ]
      }
      break
    }

    case 'charge-after': {
      fullPaid()
      r.charges = [DELIVERY(`${TODAY}, 10:05`)]
      r.events.push(ev({ at: `${TODAY}, 10:05`, who: MANAGER.name, kind: 'charge', text: 'Нараховано: Доставка 1 000 грн без ПДВ' }, 9))
      break
    }

    case 'balance': {
      if (fl) {
        r.counterparty.wallet = 1500
        r.counterparty.walletParts = [{ code: 'АР-2К41М', amount: 1500, note: 'переплата після повернення' }]
      }
      break
    }

    case 'reversal': {
      if (fl) {
        r.payments = [
          cashPayment('pay-seed-1', 5100, { rent: 2100, deposit: 3000, charges: {} }, `${TODAY}, 10:02`, 'ПКО-000180'),
        ]
        r.events = [
          ev({ at: `${TODAY}, 10:02`, who: MANAGER.name, kind: 'payment', text: 'Прийнято 5 100 грн готівкою — Каса Куренівка', paymentId: 'pay-seed-1' }, 1),
          ev({ at: `${TODAY}, 10:02`, who: '1С', kind: 'number', text: 'Присвоєно № ПКО-000180', source: '1c' }, 2),
        ]
      } else {
        fullPaid()
      }
      break
    }

    case 'zero-deposit': {
      r.depositOverride = 0
      break
    }

    case 'from-1c': {
      r.payments = [
        cashPayment('pay-seed-1c', 2000, { rent: 2000, deposit: 0, charges: {} }, `${TODAY}, 09:12`, 'ПКО-000175', {
          source: '1c',
          by: ACCOUNTANT,
        }),
        cashPayment('pay-seed-own', 3100, { rent: 100, deposit: 3000, charges: {} }, `${TODAY}, 10:08`, null),
      ]
      if (!fl) {
        // Юрособа теж може внести готівку у ФОП: без ПДВ.
        r.payments[0].cover = { rent: 2000, deposit: 0, charges: {} }
      }
      r.events = [
        ev({ at: `${TODAY}, 09:12`, who: ACCOUNTANT, kind: 'payment', text: 'ПКО-000175 на 2 000 грн заведено в 1С', paymentId: 'pay-seed-1c', source: '1c' }, 1),
        ev({ at: `${TODAY}, 10:08`, who: MANAGER.name, kind: 'payment', text: 'Прийнято 3 100 грн готівкою — Каса Куренівка', paymentId: 'pay-seed-own' }, 2),
      ]
      break
    }

    case 'discount': {
      fullPaid()
      r.charges = [
        {
          id: 'ch-discount',
          kind: 'discount',
          article: 'Знижка постійному клієнту',
          target: 'Уся оренда',
          net: 500,
          vatable: false,
          comment: 'Погоджено керівником відділення',
          createdAt: `${TODAY}, 10:10`,
          createdBy: MANAGER.name,
        },
      ]
      r.events.push(ev({ at: `${TODAY}, 10:10`, who: MANAGER.name, kind: 'charge', text: 'Знижка 500 грн: знижка постійному клієнту' }, 9))
      break
    }

    case 'big': {
      r.positions = BIG
      r.charges = [
        DELIVERY(`${TODAY}, 10:04`),
        {
          id: 'ch-chem',
          kind: 'charge',
          article: 'Витрати на хімію',
          target: 'Комплект для штукатурення',
          net: 350,
          vatable: true,
          comment: 'Ґрунтовка і пластифікатор',
          createdAt: `${TODAY}, 10:06`,
          createdBy: MANAGER.name,
        },
      ]
      break
    }
  }
  return r
}

function ulInvoice(
  id: string,
  number: string,
  group: 'rent' | 'deposit',
  amount: number,
  vatRate: number,
): PaymentInvoice {
  return {
    id,
    number,
    auto1c: true,
    createdAt: `${YESTERDAY}, 11:05`,
    createdBy: MANAGER.name,
    group,
    amount,
    vatRate,
    lines:
      group === 'rent'
        ? [{ name: `Послуга оренди ${SHURIK.name} (7 діб, з ПДВ)`, amount }]
        : [{ name: `Заставний платіж за ${SHURIK.name}`, amount }],
  }
}

function bankPayment(
  id: string,
  amount: number,
  cover: Payment['cover'],
  at: string,
  invoiceId: string,
): Payment {
  return {
    id,
    method: 'bank',
    cashboxId: 'cb-org',
    amount,
    cover,
    at,
    by: MANAGER.name,
    doc: null,
    invoiceId,
    source: 'crm',
  }
}
