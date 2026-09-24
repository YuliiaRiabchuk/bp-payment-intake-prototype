/**
 * Модель прийому коштів на оренду. Не модель бекенду: рівно те, що малюють
 * крок «Оплата» і сайдбар. Правила — §5 брифу.
 *
 * Два облікові рахунки оренди: **оренда** (позиції + доп. нарахування,
 * бо нарахування — доплати до рахунку оренди) і **застава**. Вони не
 * сумуються ніколи. Нарахування — третя група на екрані зі своїм ПДВ.
 */

export type Party = 'fl' | 'ul'

export type StageKey = 'draft' | 'payment' | 'handover' | 'active' | 'closing'

export type MethodKind = 'cash' | 'terminal' | 'bank' | 'balance'

/** Група розрахунку: що саме закриває платіж. */
export type Group = 'rent' | 'deposit' | 'charges'

export interface Cashbox {
  id: string
  /** «Каса Куренівка», «Термінал Куренівка», «Рахунок ФОП …». */
  name: string
  kind: 'cash' | 'terminal' | 'bank'
  /** Одержувач: ФОП або юрособа компанії. Визначає ПДВ. */
  org: string
  orgKind: 'fop' | 'tov'
  iban: string
  /** Відділення. `null` — спільна безготівкова, без прив'язки. */
  branch: string | null
  /** Персональна готівкова каса менеджера. */
  ownerId?: string
  /** Розрахунковий рахунок юрособи компанії (безготівка юросіб). */
  orgAccount?: boolean
}

export interface Position {
  id: string
  name: string
  sku: string
  kind: 'unit' | 'consumable' | 'kit'
  qty: number
  /** Розхідник продається поштучно — днів у нього немає. */
  days: number | null
  /** Ціна каталогу без ПДВ: за добу (одиниця, комплект) або за штуку. */
  price: number
  /** Застава за одиницю. */
  deposit: number
  /** Комплект — один рядок із вкладеним складом. */
  parts?: { name: string; qty: number }[]
}

export interface Charge {
  id: string
  kind: 'charge' | 'discount'
  /** Стаття: «Доставка», «Витрати на хімію», «Знижка постійному клієнту». */
  article: string
  /** «Уся оренда» або назва позиції. */
  target: string
  /** Сума без ПДВ, завжди додатна; знак дає `kind`. */
  net: number
  /** Стаття оподатковується. Ставку дає одержувач. */
  vatable: boolean
  comment?: string
  createdAt: string
  createdBy: string
  cancelled?: { reason: string; by: string; at: string }
}

/**
 * Що закрив платіж. Позиції нарахувань окремо: у кожного свій стан
 * «оплачене / неоплачене».
 */
export interface Cover {
  rent: number
  deposit: number
  charges: Record<string, number>
}

/** Рахунок на оплату — документ для безготівки. */
export interface PaymentInvoice {
  id: string
  /** `null` — номер ще не прийшов з 1С, друк недоступний. */
  number: string | null
  auto1c: boolean
  createdAt: string
  createdBy: string
  /** Що в рахунку. Фізособа: усе; юрособа: оренда з ПДВ / застава без ПДВ. */
  group: 'all' | 'rent' | 'deposit' | 'charges'
  amount: number
  vatRate: number
  lines: { name: string; amount: number }[]
  cancelled?: { by: string; at: string }
}

export interface Payment {
  id: string
  method: MethodKind
  cashboxId: string | null
  /** Сума, яку підтвердив менеджер. */
  amount: number
  cover: Cover
  at: string
  by: string
  /** ПКО. Для балансу і розрахункового рахунку юрособи — немає. */
  doc: { number: string | null; auto1c: boolean } | null
  invoiceId?: string
  source: 'crm' | '1c'
  /** Проведення бухгалтером у 1С з фактичною сумою (наступного дня). */
  booked1c?: { amount: number; at: string }
  /** Сторно: ПКО «Анульований», запис лишається. */
  annulled?: { by: string; at: string }
}

/**
 * Чернетка способу оплати. Живе на оренді (стан зберігається, §5):
 * повернувшись, менеджер бачить свій спосіб, касу і рахунок.
 */
export interface Draft {
  id: string
  method: MethodKind | null
  cashboxId: string | null
  /** 0 — поле порожнє. */
  amount: number
  /** Куди йдуть гроші. `auto` — водоспад оренда → нарахування → застава. */
  target: 'auto' | 'rent' | 'deposit' | 'charges'
  /**
   * Явний склад: вибрані позиції. `undefined` — автоматично.
   * Ключі: 'rent', 'deposit', id нарахування.
   */
  items?: string[]
  invoiceId?: string
}

export type EventKind =
  | 'payment'
  | 'annul'
  | 'invoice'
  | 'invoice-cancel'
  | 'charge'
  | 'charge-cancel'
  | 'number'
  | 'booked'
  | 'allow-handover'
  | 'handover'

/** Запис хронології. Скасування — теж запис, нічого не видаляється. */
export interface RentEvent {
  id: string
  at: string
  who: string
  kind: EventKind
  text: string
  paymentId?: string
  source?: 'crm' | '1c'
}

export interface Counterparty {
  name: string
  phone: string
  edrpou?: string
  /** Реквізити для видачі заповнені. Ні — далі оплати не пускає. */
  requisitesOk: boolean
  /** Операційний баланс («гаманець»). Мінус — борг. */
  wallet: number
  /** З яких оренд склався гаманець. */
  walletParts: { code: string; amount: number; note: string }[]
  /** Заставний баланс: заморожений до повернення. */
  depositBalance: number
  depositParts: { code: string; amount: number }[]
  activeRents: number
}

export interface Rent {
  id: string
  code: string
  party: Party
  counterparty: Counterparty
  manager: { id: string; name: string; initials: string }
  branch: string
  warehouse: string
  issueAt: string
  returnAt: string
  positions: Position[]
  /** Застава не за позиціями: друга оренда клієнта, заставу не беруть. */
  depositOverride?: number
  charges: Charge[]
  payments: Payment[]
  invoices: PaymentInvoice[]
  drafts: Draft[]
  events: RentEvent[]
  handoverAllowed?: { by: string; at: string }
  handedOver?: boolean
}

/** Аліаси для степера, перенесеного з bp-1259. */
export type RentStageKey = StageKey
export type RentStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_HANDOVER'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'OVERDUE'
  | 'AWAITING_CLOSURE'
  | 'CLOSED'
