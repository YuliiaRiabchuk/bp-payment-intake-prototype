import { cashboxOf } from '@/mock/cashboxes'
import type { Charge, Cover, Draft, Payment, Position, Rent } from '@/mock/types'

/**
 * Розрахунок грошей оренди. ОДНЕ місце, звідки беруть числа крок, кнопки,
 * гейт і сайдбар у варіантах A–D (§6: «скільки ще прийняти» має одну
 * головну поверхню, а повтори беруться з того самого розрахунку).
 *
 * Варіант 0 теж читає звідси: розбіжності проду між поверхнями — це
 * розбіжності ПІДПИСІВ і місць, а не арифметики, і порт їх відтворює
 * розкладкою, а не іншою формулою.
 */

export const gross = (net: number, rate: number) => Math.round((net * (100 + rate)) / 100)

/** ПДВ, що сидить усередині валової суми. */
export const vatInside = (grossAmount: number, rate: number) =>
  rate > 0 ? Math.round((grossAmount * rate) / (100 + rate)) : 0

export function lineNet(p: Position): number {
  return p.kind === 'consumable' ? p.qty * p.price : p.qty * (p.days ?? 1) * p.price
}

/**
 * Ставка ПДВ рахунку оренди. Її визначає ОДЕРЖУВАЧ (§5): ТОВ +20 %, ФОП без
 * ПДВ. Вирішує перший названий одержувач грошей за оренду — прийнятий
 * платіж, потім чернетка. Юрособа без названого одержувача рахується на
 * розрахунковий рахунок ТОВ, тобто з ПДВ. Фізособа платить ФОПам.
 */
export function rentVatRate(rent: Rent): number {
  if (rent.party === 'fl') return 0
  const fromPayment = rent.payments.find(
    (p) => !p.annulled && p.cashboxId && p.cover.rent > 0,
  )
  const fromDraft = rent.drafts.find(
    (d) => d.method && d.method !== 'balance' && d.cashboxId && d.target !== 'deposit',
  )
  const receiver = cashboxOf(fromPayment?.cashboxId ?? fromDraft?.cashboxId)
  if (!receiver) return 20
  return receiver.orgKind === 'tov' ? 20 : 0
}

export function chargeGross(c: Charge, rate: number): number {
  return gross(c.net, c.vatable ? rate : 0)
}

/** Сума, яку фактично зараховано: 1С перебиває підтвердження менеджера. */
export const factOf = (p: Payment) => p.booked1c?.amount ?? p.amount

export interface ChargeBalance {
  charge: Charge
  gross: number
  vat: number
  paid: number
  remaining: number
}

export interface Balance {
  rate: number
  rent: {
    net: number
    gross: number
    vat: number
    /** Знижки (додатне число), що зменшують рахунок оренди. */
    discount: number
    /** Оренда до сплати після знижок. */
    due: number
    paid: number
    remaining: number
  }
  deposit: { due: number; paid: number; remaining: number }
  charges: ChargeBalance[]
  chargesDue: number
  chargesPaid: number
  chargesRemaining: number
  /** Рахунок оренди цілком (оренда + нарахування). Для варіанта 0. */
  rentAccount: { due: number; paid: number; remaining: number }
  /** Скільки ще прийняти — ЄДИНА формула. */
  remaining: number
  /** Переплата до повернення (знижка після оплати, скасоване нарахування). */
  overpay: number
  /** Недоплата за даними 1С (проведено менше, ніж підтвердив менеджер). */
  shortfall1c: number
}

export function balanceOf(rent: Rent): Balance {
  const rate = rentVatRate(rent)
  const rentNet = rent.positions.reduce((s, p) => s + lineNet(p), 0)
  const rentGross = gross(rentNet, rate)
  const depositDue =
    rent.depositOverride ??
    rent.positions.reduce((s, p) => s + (p.kind === 'consumable' ? 0 : p.qty * p.deposit), 0)

  const live = rent.payments.filter((p) => !p.annulled)
  let paidRent = 0
  let paidDeposit = 0
  const paidCharge = new Map<string, number>()
  let shortfall1c = 0
  for (const p of live) {
    const fact = factOf(p)
    shortfall1c += Math.max(0, p.amount - fact)
    // Недоплата з 1С зменшує те, що платіж закрив, пропорційно.
    const k = p.amount > 0 ? fact / p.amount : 0
    paidRent += Math.round(p.cover.rent * k)
    paidDeposit += Math.round(p.cover.deposit * k)
    for (const [id, amount] of Object.entries(p.cover.charges)) {
      paidCharge.set(id, (paidCharge.get(id) ?? 0) + Math.round(amount * k))
    }
  }

  const discount = rent.charges
    .filter((c) => c.kind === 'discount' && !c.cancelled)
    .reduce((s, c) => s + chargeGross(c, rate), 0)
  const rentDue = Math.max(0, rentGross - discount)

  const charges: ChargeBalance[] = rent.charges
    .filter((c) => c.kind === 'charge')
    .map((c) => {
      const g = c.cancelled ? 0 : chargeGross(c, rate)
      const paid = paidCharge.get(c.id) ?? 0
      return {
        charge: c,
        gross: chargeGross(c, rate),
        vat: vatInside(chargeGross(c, rate), c.vatable ? rate : 0),
        paid,
        remaining: Math.max(0, g - paid),
      }
    })
  const chargesDue = charges.filter((c) => !c.charge.cancelled).reduce((s, c) => s + c.gross, 0)
  const chargesPaid = charges.reduce((s, c) => s + c.paid, 0)
  const chargesRemaining = charges.reduce((s, c) => s + c.remaining, 0)

  const rentRemaining = Math.max(0, rentDue - paidRent)
  const depositRemaining = Math.max(0, depositDue - paidDeposit)

  const overpay =
    Math.max(0, paidRent - rentDue) +
    charges.reduce(
      (s, c) => s + Math.max(0, c.paid - (c.charge.cancelled ? 0 : c.gross)),
      0,
    )

  return {
    rate,
    rent: {
      net: rentNet,
      gross: rentGross,
      vat: vatInside(rentGross, rate),
      discount,
      due: rentDue,
      paid: paidRent,
      remaining: rentRemaining,
    },
    deposit: { due: depositDue, paid: paidDeposit, remaining: depositRemaining },
    charges,
    chargesDue,
    chargesPaid,
    chargesRemaining,
    rentAccount: {
      due: rentDue + chargesDue,
      paid: paidRent + chargesPaid,
      remaining: rentRemaining + chargesRemaining,
    },
    remaining: rentRemaining + chargesRemaining + depositRemaining,
    overpay,
    shortfall1c,
  }
}

/** Скільки ще прийняти. Усі варіанти A–D беруть число тільки звідси. */
export const remainingOf = (rent: Rent) => balanceOf(rent).remaining

export type ItemKey = 'rent' | 'deposit' | string

/**
 * Місткість кожної позиції платежу: що ще можна закрити. Порядок —
 * водоспад проду: оренда → нарахування (за часом) → застава.
 */
export function roomsOf(bal: Balance): { key: ItemKey; room: number }[] {
  return [
    { key: 'rent', room: bal.rent.remaining },
    ...bal.charges
      .filter((c) => !c.charge.cancelled)
      .sort((a, b) => a.charge.createdAt.localeCompare(b.charge.createdAt))
      .map((c) => ({ key: c.charge.id, room: c.remaining })),
    { key: 'deposit', room: bal.deposit.remaining },
  ]
}

/** Які позиції допускає ціль чернетки. */
export function itemsOfTarget(target: Draft['target'], bal: Balance): ItemKey[] | undefined {
  if (target === 'auto') return undefined
  if (target === 'deposit') return ['deposit']
  if (target === 'charges') return bal.charges.map((c) => c.charge.id)
  return ['rent', ...bal.charges.map((c) => c.charge.id)]
}

/**
 * Розподіл суми по позиціях. `items` — явний склад (галочки); без нього —
 * усі позиції водоспадом. Залишок, якому немає місця, повертається окремо:
 * це «перебір», і прийом його не пропускає.
 */
export function allocate(
  bal: Balance,
  amount: number,
  items?: ItemKey[],
): { cover: Cover; leftover: number } {
  const cover: Cover = { rent: 0, deposit: 0, charges: {} }
  let left = amount
  for (const { key, room } of roomsOf(bal)) {
    if (items && !items.includes(key)) continue
    const take = Math.min(room, left)
    if (take <= 0) continue
    left -= take
    if (key === 'rent') cover.rent += take
    else if (key === 'deposit') cover.deposit += take
    else cover.charges[key] = (cover.charges[key] ?? 0) + take
  }
  return { cover, leftover: left }
}

/** Скільки можна прийняти на вибраний склад. */
export function roomOf(bal: Balance, items?: ItemKey[]): number {
  return roomsOf(bal)
    .filter((r) => !items || items.includes(r.key))
    .reduce((s, r) => s + r.room, 0)
}

export const coverTotal = (c: Cover) =>
  c.rent + c.deposit + Object.values(c.charges).reduce((s, v) => s + v, 0)

export const coverCharges = (c: Cover) => Object.values(c.charges).reduce((s, v) => s + v, 0)

/** ПДВ усередині платежу: оренда і оподатковані нарахування за ставкою. */
export function vatOfCover(rent: Rent, cover: Cover, rate: number): number {
  let vat = vatInside(cover.rent, rate)
  for (const [id, amount] of Object.entries(cover.charges)) {
    const c = rent.charges.find((x) => x.id === id)
    if (c?.vatable) vat += vatInside(amount, rate)
  }
  return vat
}

/**
 * Гейт видачі (§5):
 *  - `settled` — нічого не лишилось;
 *  - `partial` — внесено хоча б частину оренди або застави: менеджер іде сам;
 *  - `unpaid` — жодної оплати: тільки «Пропустити оплату» керівника.
 * Непідтверджена безготівка — чернетка, тобто не оплата.
 */
export type HandoverState = 'settled' | 'partial' | 'unpaid'

export function handoverStateOf(rent: Rent, bal = balanceOf(rent)): HandoverState {
  if (bal.remaining <= 0) return 'settled'
  const any = rent.payments.some((p) => !p.annulled && p.cover.rent + p.cover.deposit > 0)
  return any ? 'partial' : 'unpaid'
}

export function canHandover(rent: Rent, bal = balanceOf(rent)): boolean {
  if (!rent.counterparty.requisitesOk) return false
  return handoverStateOf(rent, bal) !== 'unpaid' || !!rent.handoverAllowed
}

/** Жива сума гаманця, доступна для оплати балансом. */
export const walletAvailable = (rent: Rent) => Math.max(0, rent.counterparty.wallet)

/** Сумарно прийнято (для рядка реєстру): усе, крім анульованого. */
export const acceptedTotal = (rent: Rent) =>
  rent.payments.filter((p) => !p.annulled).reduce((s, p) => s + factOf(p), 0)

/**
 * Розподіл кількох чернеток по черзі: кожна бере з того, що лишили
 * попередні. Так рядок бачить свою «кімнату» і те, що саме він закриє.
 */
export function allocateDrafts(
  bal: Balance,
  drafts: Draft[],
): Map<string, { cover: Cover; room: number; leftover: number }> {
  const rooms = new Map(roomsOf(bal).map((r) => [r.key, r.room]))
  const out = new Map<string, { cover: Cover; room: number; leftover: number }>()
  for (const d of drafts) {
    const items = d.items ?? itemsOfTarget(d.target, bal)
    const keys = [...rooms.keys()].filter((k) => !items || items.includes(k))
    const room = keys.reduce((s, k) => s + (rooms.get(k) ?? 0), 0)
    const cover: Cover = { rent: 0, deposit: 0, charges: {} }
    let left = d.amount
    for (const k of keys) {
      const take = Math.min(rooms.get(k) ?? 0, left)
      if (take <= 0) continue
      left -= take
      rooms.set(k, (rooms.get(k) ?? 0) - take)
      if (k === 'rent') cover.rent += take
      else if (k === 'deposit') cover.deposit += take
      else cover.charges[k] = (cover.charges[k] ?? 0) + take
    }
    out.set(d.id, { cover, room, leftover: left })
  }
  return out
}
