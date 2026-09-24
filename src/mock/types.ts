/**
 * Типи мок-даних прототипу. Це НЕ модель бекенду: тут рівно те, що малює
 * картка оренди. Скоуп прототипу — один екран, тож сутності описані плоско,
 * без нормалізації і без полів, які ніде не читаються.
 */

export type RentStageKey =
  | 'draft'
  | 'payment'
  | 'handover'
  | 'active'
  | 'closing'

/** Точний підстан під макроетапом — те, що показує бейдж у хедері. */
export type RentStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_HANDOVER'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'OVERDUE'
  | 'AWAITING_CLOSURE'
  | 'CLOSED'

export type CounterpartyKind = 'FL' | 'UL'

export interface Counterparty {
  id: string
  kind: CounterpartyKind
  name: string
  /** ФО — телефон; ЮО — контактна особа з телефоном. */
  phone: string
  /** ЮО — код ЄДРПОУ (заглушка). */
  edrpou?: string
  /** Операційний баланс контрагента, ₴. Може піти в мінус — це борг. */
  operationalBalance: number
  /** Заставний баланс — заморожений до повернення, ₴. */
  depositBalance: number
}

export interface RentPosition {
  id: string
  name: string
  qty: number
  pricePerDay: number
  accepted: boolean
  acceptedAt?: string
}

/** Рядок рахунку — база, знижка, доп. нарахування. */
export interface InvoiceLine {
  id: string
  label: string
  amount: number
  kind: 'base' | 'discount' | 'surcharge'
}

export interface Invoice {
  kind: 'rent' | 'deposit'
  total: number
  paid: number
  lines: InvoiceLine[]
  /** ЮО: оренда з ПДВ, застава без ПДВ. ФО — без позначки. */
  vat?: 'with' | 'without'
}

export type PaymentMethodKind = 'cash' | 'bank' | 'terminal' | 'balance'

export type PaymentStatus = 'draft' | 'awaiting' | 'confirmed'

export interface Payment {
  id: string
  method: PaymentMethodKind
  /** Каса довідника: готівкова персональна, безготівкова спільна. */
  cashbox: string
  status: PaymentStatus
  amount: number
  /** Документ приймання: ПКО для готівки, платіжка для безналу. */
  document?: string
  purpose?: string
  at?: string
  /** Платіж закриває доп. нарахування, а не початковий розрахунок. */
  forSurchargeId?: string
  /**
   * Розбивка одного документа по двох рахунках.
   *
   * Готівку часто приймають одним ПКО «оренда + застава». Документ один,
   * грошей двоє: оренда і застава не сумуються, тож у книзі рухів такий ПКО
   * дає два рядки з одним номером. Без розбивки застава осідала б на
   * рахунку оренди і підсумки в сайдбарі переставали сходитись.
   */
  allocation?: { rent: number; deposit: number }
}

export interface RentDocument {
  id: string
  name: string
  number?: string
  date?: string
  /** Документ ще не згенеровано — рядок-заготовка. */
  pending?: boolean
  signed?: boolean
}

/**
 * Що саме породило рядок наскрізної секції.
 *
 *  - `manual` — менеджер завів нарахування руками. Стаття витрат обовʼязкова.
 *  - `extension` — доплата за продовження строку. Статті немає: це не витрата,
 *    а різниця по тарифу.
 *  - `overdue` — прострочення. Рахується саме, утримується із застави, і форма
 *    нарахування для нього не зʼявляється взагалі (BRIEF §6).
 */
export type SurchargeKind = 'manual' | 'extension' | 'overdue'

/**
 * Життя рядка. `withheld` — тільки для прострочення: гроші не приймаються,
 * різниця утримується із застави при поверненні.
 */
export type SurchargeStatus =
  | 'open'
  | 'invoiced'
  | 'settled'
  | 'withheld'
  | 'cancelled'

/** Хто зробив дію. Клієнт бачиться окремо: він діяв віддалено, не колега. */
export type ActorKind = 'manager' | 'client' | 'system'

/** Запис наскрізного блока «Доп. нарахування». */
export interface Surcharge {
  id: string
  kind: SurchargeKind
  /** ID позиції або `null` = «Уся оренда». */
  positionId: string | null
  amount: number
  /** Стаття витрат з 1С. `null` у системних рядків — там її не вибирають. */
  articleId: string | null
  comment?: string
  /**
   * Ставка ПДВ РЯДКА, а не документа. Всередині однієї оренди частина
   * позицій іде без ПДВ (санкції), частина з ПДВ — модель повторює 1С.
   */
  vat?: 0 | 20
  createdAt: string
  source: ActorKind
  status: SurchargeStatus
  /** Документ, яким рядок закрито: ПКО у ФО, окремий рахунок у ЮО. */
  document?: string
  settledAt?: string
  /** Довидача розхідника — розвилка §7.7, прототип її не вирішує. */
  disputed?: boolean
}

export interface Rent {
  id: string
  displayCode: string
  externalId1c: string
  status: RentStatus
  stage: RentStageKey
  /** Найдальший фактично досягнутий етап — фронтир степера. */
  maxStage: RentStageKey
  counterparty: Counterparty
  manager: { initials: string; name: string }
  branch: string
  issueAt: string
  plannedReturnAt: string
  /** Доба, на якій оренда зараз. Більша за план = прострочення. */
  currentDay: number
  plannedDays: number
  positions: RentPosition[]
  rentInvoice: Invoice
  depositInvoice: Invoice
  payments: Payment[]
  documents: RentDocument[]
  surcharges: Surcharge[]
  /** Каса менеджера — персональна готівкова, у неї падають ПКО доплат. */
  cashbox: string
}
