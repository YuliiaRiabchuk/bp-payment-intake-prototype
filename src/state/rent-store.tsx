import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { INITIAL_RENTS, type RentId } from '@/mock/rents'
import { DISPUTED_ARTICLE_IDS } from '@/mock/expense-articles'
import type {
  ActorKind,
  PaymentMethodKind,
  Rent,
  Surcharge,
} from '@/mock/types'

/**
 * Каса за способом оплати.
 *
 * Готівка йде в персональну касу відділення, решта — у спільні безготівкові.
 * Заглушки: реальний довідник кас живе в адмінці (`09-system-admin`).
 */
const METHOD_CASHBOX: Record<PaymentMethodKind, string> = {
  cash: 'Каса Позняки',
  terminal: 'Термінал Позняки',
  bank: 'Розрахунковий рахунок ФОП',
  balance: 'Баланс клієнта',
}

/**
 * Стан прототипу. Він мутабельний навмисно: цінність цієї роботи в ПЕРЕХОДАХ,
 * а не в кадрах. Додав нарахування — воно зʼявилось у хронології; прийняв
 * гроші — рядок поїхав у закриті з номером документа; продовжив строк —
 * зʼявилась доплата. Статичний мок цього не показує.
 *
 * Годинник теж у стані: кожна дія рухає його на кілька хвилин уперед. Так
 * підписи часу виглядають правдиво і при цьому лишаються відтворюваними —
 * прогін дає ті самі кадри незалежно від того, коли його запустили.
 */

interface Clock {
  /** Доба показу, «29.08». */
  day: string
  minutes: number
}

interface State {
  rents: Record<string, Rent>
  clock: Clock
  /** Лічильники номерів документів — щоб ПКО і рахунки йшли по порядку. */
  nextCashOrder: number
  nextInvoice: number
  seq: number
}

const INITIAL_STATE: State = {
  rents: INITIAL_RENTS,
  clock: { day: '29.08', minutes: 10 * 60 + 12 },
  nextCashOrder: 181,
  nextInvoice: 210,
  seq: 1,
}

function stamp(clock: Clock): string {
  const h = String(Math.floor(clock.minutes / 60) % 24).padStart(2, '0')
  const m = String(clock.minutes % 60).padStart(2, '0')
  return `${clock.day}, ${h}:${m}`
}

function tick(clock: Clock, by = 3): Clock {
  return { ...clock, minutes: clock.minutes + by }
}

/**
 * Дати в прототипі — короткі рядки «28.08», як їх бачить менеджер. Рік
 * фіксований: це заглушка, а не календар, і жодна логіка від нього не
 * залежить — потрібен лише коректний перехід через кінець місяця.
 */
function addDays(ddmm: string, days: number): string {
  const [d, m] = ddmm.split('.').map(Number)
  if (!d || !m) return ddmm
  const date = new Date(2026, m - 1, d + days)
  return `${String(date.getDate()).padStart(2, '0')}.${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`
}

export type Action =
  | {
      type: 'ADD_SURCHARGE'
      rentId: RentId
      positionId: string | null
      amount: number
      articleId: string
      comment?: string
      /** Ставка рядка. Форма підставляє її за статтею. */
      vat?: 0 | 20
      source: ActorKind
    }
  /** ФО: приймаємо готівку — народжується ПКО. */
  /**
   * Приймання доплати. `method` приходить з інтерфейсу: за замовчуванням
   * готівка (бриф §6), але менеджер міняє її, не виходячи з рядка.
   * Документ у всіх випадках ПКО — по грошах це прихід у касу.
   */
  | {
      type: 'SETTLE_CASH'
      rentId: RentId
      surchargeId: string
      method?: PaymentMethodKind
    }
  /** ЮО: виставляємо ОКРЕМИЙ рахунок з ПДВ. Раніше виставлений не чіпаємо. */
  | { type: 'ISSUE_INVOICE'; rentId: RentId; surchargeId: string }
  /** ЮО, крок 2: менеджер підтверджує по квитанції клієнта. */
  | { type: 'CONFIRM_BANK'; rentId: RentId; surchargeId: string }
  | { type: 'CANCEL_SURCHARGE'; rentId: RentId; surchargeId: string }
  | { type: 'EXTEND_TERM'; rentId: RentId; days: number; source: ActorKind }
  | { type: 'ACCEPT_POSITION'; rentId: RentId; positionId: string }
  | { type: 'ACCEPT_ALL'; rentId: RentId }
  | { type: 'RESET' }
  /**
   * Точкова латка оренди — ТІЛЬКИ для сцен граничних станів.
   *
   * Нуль застави, від'ємний баланс, довге найменування послуги — це не
   * наслідки дій менеджера, а дані, які приїжджають такими. Відтворити їх
   * послідовністю ADD_SURCHARGE неможливо, а робити під кожен край окрему
   * копію моку означає розвести дані, які мають бути одні. Латка живе поруч
   * зі сценами і в продуктових шляхах не використовується.
   */
  | { type: 'PATCH_RENT'; rentId: RentId; patch: Partial<Rent> }
  /** Сцена: скинути стан і програти її набір дій одним комітом. */
  | { type: 'APPLY_SCENE'; actions: Action[] }

/** ₴ за добу по всій оренді — база розрахунку доплати за продовження. */
function dailyRate(rent: Rent): number {
  return rent.positions.reduce((s, p) => s + p.qty * p.pricePerDay, 0)
}

function updateRent(
  state: State,
  rentId: RentId,
  fn: (rent: Rent) => Rent,
): Record<string, Rent> {
  const rent = state.rents[rentId]
  if (!rent) return state.rents
  return { ...state.rents, [rentId]: fn(rent) }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE

    case 'PATCH_RENT':
      return {
        ...state,
        rents: updateRent(state, action.rentId, (r) => ({ ...r, ...action.patch })),
      }

    case 'APPLY_SCENE':
      // Сцена завжди рахується від чистого стану, інакше два перемикання
      // поспіль дають різні екрани під тією самою назвою.
      return action.actions.reduce(reducer, INITIAL_STATE)

    case 'ADD_SURCHARGE': {
      const at = stamp(state.clock)
      const id = `s-${state.seq}`
      const entry: Surcharge = {
        id,
        kind: 'manual',
        positionId: action.positionId,
        amount: action.amount,
        articleId: action.articleId,
        comment: action.comment?.trim() || undefined,
        vat: action.vat,
        createdAt: at,
        source: action.source,
        status: 'open',
        disputed: DISPUTED_ARTICLE_IDS.includes(action.articleId),
      }
      return {
        ...state,
        seq: state.seq + 1,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          // Хронологія зберігається: нове йде В КІНЕЦЬ, після початкової
          // оплати і видачі, у порядку створення (BRIEF §6).
          surcharges: [...r.surcharges, entry],
        })),
      }
    }

    case 'SETTLE_CASH': {
      const at = stamp(state.clock)
      const doc = `ПКО-000${state.nextCashOrder}`
      const rent = state.rents[action.rentId]
      const target = rent?.surcharges.find((s) => s.id === action.surchargeId)
      if (!rent || !target) return state
      const method = action.method ?? 'cash'
      return {
        ...state,
        nextCashOrder: state.nextCashOrder + 1,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          surcharges: r.surcharges.map((s) =>
            s.id === action.surchargeId
              ? { ...s, status: 'settled', document: doc, settledAt: at }
              : s,
          ),
          // Документ лягає в реєстр платежів кроку «Оплата». Секція його не
          // переказує — вона на нього посилається номером.
          payments: [
            ...r.payments,
            {
              id: `pay-${doc}`,
              method,
              cashbox: METHOD_CASHBOX[method] ?? r.cashbox,
              status: 'confirmed' as const,
              amount: target.amount,
              document: doc,
              purpose: 'Доп. нарахування',
              at,
              forSurchargeId: target.id,
            },
          ],
          documents: [
            ...r.documents,
            {
              id: `d-${doc}`,
              name: 'Прибутковий касовий ордер',
              number: doc,
              date: state.clock.day,
            },
          ],
        })),
      }
    }

    case 'ISSUE_INVOICE': {
      const at = stamp(state.clock)
      const doc = `СФ-000${state.nextInvoice}`
      const rent = state.rents[action.rentId]
      const target = rent?.surcharges.find((s) => s.id === action.surchargeId)
      if (!rent || !target) return state
      return {
        ...state,
        nextInvoice: state.nextInvoice + 1,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          surcharges: r.surcharges.map((s) =>
            s.id === action.surchargeId
              ? { ...s, status: 'invoiced', document: doc, settledAt: at }
              : s,
          ),
          documents: [
            ...r.documents,
            { id: `d-${doc}`, name: 'Рахунок на оплату', number: doc, date: state.clock.day },
          ],
        })),
      }
    }

    case 'CONFIRM_BANK': {
      const at = stamp(state.clock)
      const rent = state.rents[action.rentId]
      const target = rent?.surcharges.find((s) => s.id === action.surchargeId)
      if (!rent || !target || !target.document) return state
      return {
        ...state,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          surcharges: r.surcharges.map((s) =>
            s.id === action.surchargeId ? { ...s, status: 'settled', settledAt: at } : s,
          ),
          payments: [
            ...r.payments,
            {
              id: `pay-${target.document}`,
              method: 'bank' as const,
              cashbox: r.cashbox,
              status: 'confirmed' as const,
              amount: target.amount,
              document: `Рахунок ${target.document}`,
              purpose: 'Доп. нарахування, у т.ч. ПДВ',
              at,
              forSurchargeId: target.id,
            },
          ],
        })),
      }
    }

    case 'CANCEL_SURCHARGE':
      // Відміна — подія, а не видалення: рядок лишається в хронології
      // закресленим. Кросмодульний інваріант BP Space.
      return {
        ...state,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          surcharges: r.surcharges.map((s) =>
            s.id === action.surchargeId ? { ...s, status: 'cancelled' } : s,
          ),
        })),
      }

    case 'EXTEND_TERM': {
      const at = stamp(state.clock)
      const rent = state.rents[action.rentId]
      if (!rent) return state
      const amount = dailyRate(rent) * action.days
      const entry: Surcharge = {
        id: `s-${state.seq}`,
        kind: 'extension',
        positionId: null,
        amount,
        // Продовження — не витрата, а різниця по тарифу. Статті тут немає.
        articleId: null,
        createdAt: at,
        source: action.source,
        status: 'open',
      }
      return {
        ...state,
        seq: state.seq + 1,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => {
          const plannedDays = r.plannedDays + action.days
          // Продовження, яке накрило прострочені доби, знімає саме
          // прострочення: ці доби тепер оплачені по тарифу, а не позичені.
          // Утримання із застави разом із ними втрачає підставу, і рядок
          // іде в скасовані — не зникає, бо відміна це подія, а не видалення.
          const resolved = plannedDays >= r.currentDay
          return {
            ...r,
            plannedDays,
            // Строк рухається цілком: і лічильник діб, і дата повернення.
            // Інакше «доба 5 з 5» стоїть проти «повернення 28.08» і екран
            // сам собі суперечить.
            plannedReturnAt: addDays(r.plannedReturnAt, action.days),
            status: resolved && r.status === 'OVERDUE' ? 'ACTIVE' : r.status,
            surcharges: [
              ...r.surcharges.map((s) =>
                resolved && s.kind === 'overdue' && s.status === 'withheld'
                  ? { ...s, status: 'cancelled' as const }
                  : s,
              ),
              entry,
            ],
          }
        }),
      }
    }

    case 'ACCEPT_POSITION':
      return {
        ...state,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          positions: r.positions.map((p) =>
            p.id === action.positionId
              ? { ...p, accepted: true, acceptedAt: state.clock.day }
              : p,
          ),
        })),
      }

    case 'ACCEPT_ALL':
      return {
        ...state,
        clock: tick(state.clock),
        rents: updateRent(state, action.rentId, (r) => ({
          ...r,
          positions: r.positions.map((p) =>
            p.accepted ? p : { ...p, accepted: true, acceptedAt: state.clock.day },
          ),
          status: 'AWAITING_CLOSURE',
          stage: 'closing',
          maxStage: 'closing',
        })),
      }

    default:
      return state
  }
}

interface Store {
  rents: Record<string, Rent>
  clockDay: string
  dispatch: (action: Action) => void
}

const RentStoreContext = createContext<Store | null>(null)

export function RentStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const value = useMemo(
    () => ({ rents: state.rents, clockDay: state.clock.day, dispatch }),
    [state.rents, state.clock.day],
  )
  return <RentStoreContext.Provider value={value}>{children}</RentStoreContext.Provider>
}

export function useRentStore(): Store {
  const ctx = useContext(RentStoreContext)
  if (!ctx) throw new Error('useRentStore must be used inside RentStoreProvider')
  return ctx
}

/* ─── Похідні величини. Рахуються з рядків, не зберігаються окремо ────── */

/** Нарахування, які ще чекають грошей. Прострочення сюди не входить. */
export function openSurcharges(rent: Rent): Surcharge[] {
  return rent.surcharges.filter(
    (s) => s.kind !== 'overdue' && (s.status === 'open' || s.status === 'invoiced'),
  )
}

/** Скільки клієнт винен за нарахуваннями понад початковий розрахунок. */
export function outstandingAmount(rent: Rent): number {
  return openSurcharges(rent).reduce((sum, s) => sum + s.amount, 0)
}

/** Різниця за простроченням — утримується із застави, грошима не приймається. */
export function withheldAmount(rent: Rent): number {
  return rent.surcharges
    .filter((s) => s.kind === 'overdue' && s.status === 'withheld')
    .reduce((sum, s) => sum + s.amount, 0)
}

/** Рядки, які секція реально показує: скасовані лишаються, бо це хронологія. */
export function visibleSurcharges(rent: Rent): Surcharge[] {
  return rent.surcharges
}
