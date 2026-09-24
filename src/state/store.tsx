import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { allocate, balanceOf, gross, itemsOfTarget, rentVatRate, type ItemKey } from '@/domain/money'
import { cashboxOf, MANAGER } from '@/mock/cashboxes'
import { formatMoney } from '@/lib/money'
import type { Charge, Draft, MethodKind, Payment, PaymentInvoice, Rent, RentEvent } from '@/mock/types'

/**
 * Стан прототипу. Мутабельний навмисно: цінність у ПЕРЕХОДАХ. Прийняв гроші —
 * рядок став платежем, номер з 1С прийшов за кілька секунд, сторно лишило
 * обидва записи в хронології.
 *
 * Годинник теж у стані: кожна дія рухає його на 2 хвилини. Підписи часу
 * правдоподібні й відтворювані — прогін дає ті самі кадри будь-коли.
 */

interface State {
  rent: Rent
  minutes: number
  nextPko: number
  nextInvoice: number
  seq: number
  /** Сцена «помилка збереження»: наступний прийом не записується. */
  failNextSave: boolean
  lastError: string | null
}

const START_MINUTES = 10 * 60 + 12

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const METHOD_LABEL: Record<MethodKind, string> = {
  cash: 'Готівка',
  terminal: 'Термінал',
  bank: 'Банківський переказ',
  balance: 'Рахунок контрагента',
}

const METHOD_INSTR: Record<MethodKind, string> = {
  cash: 'готівкою',
  terminal: 'терміналом',
  bank: 'переказом',
  balance: 'з балансу клієнта',
}

export type Action =
  | { type: 'APPLY'; rent: Rent }
  | { type: 'DRAFT_ADD'; draft?: Partial<Draft> }
  | { type: 'DRAFT_PATCH'; id: string; patch: Partial<Draft> }
  | { type: 'DRAFT_REMOVE'; id: string }
  | {
      type: 'INVOICE_ISSUE'
      draftId?: string
      group: PaymentInvoice['group']
      amount: number
      lines?: PaymentInvoice['lines']
    }
  | {
      type: 'ACCEPT'
      draftId?: string
      method: MethodKind
      cashboxId: string | null
      amount: number
      items?: ItemKey[]
      target?: Draft['target']
      invoiceId?: string
    }
  /**
   * Рахунок на оплату на прохання клієнта: народжується чернетка переказу
   * з цим рахунком. Вона чекає грошей і живе на оренді, поки менеджер не
   * підтвердить надходження за квитанцією (§5).
   */
  | {
      type: 'BANK_REQUEST'
      target: Draft['target']
      group: PaymentInvoice['group']
      amount: number
      cashboxId: string | null
    }
  | { type: 'ASSIGN_NUMBERS' }
  | { type: 'ANNUL'; paymentId: string }
  | {
      type: 'CHARGE_ADD'
      kind: Charge['kind']
      article: string
      target: string
      net: number
      vatable: boolean
      comment?: string
    }
  | { type: 'CHARGE_CANCEL'; id: string; reason: string }
  | { type: 'ALLOW_HANDOVER' }
  | { type: 'HANDOVER' }
  | { type: 'SET_FAIL_NEXT'; value: boolean }
  | { type: 'CLEAR_ERROR' }

function stamp(s: State, day = '24.09') {
  return `${day}, ${hhmm(s.minutes)}`
}

function withEvent(rent: Rent, s: State, e: Omit<RentEvent, 'id' | 'at' | 'who'> & { who?: string }): Rent {
  return {
    ...rent,
    events: [
      ...rent.events,
      { id: `e-${s.seq}`, at: stamp(s), who: e.who ?? MANAGER.name, ...e },
    ],
  }
}

function tick(s: State): State {
  return { ...s, minutes: s.minutes + 2, seq: s.seq + 1 }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'APPLY':
      return { ...INITIAL, rent: action.rent }

    case 'DRAFT_ADD': {
      const s = tick(state)
      const draft: Draft = {
        id: `draft-${s.seq}`,
        method: null,
        cashboxId: null,
        amount: 0,
        target: state.rent.party === 'ul' ? 'rent' : 'auto',
        ...action.draft,
      }
      return { ...s, rent: { ...s.rent, drafts: [...s.rent.drafts, draft] } }
    }

    case 'DRAFT_PATCH':
      return {
        ...state,
        rent: {
          ...state.rent,
          drafts: state.rent.drafts.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
        },
      }

    case 'DRAFT_REMOVE': {
      // Спосіб знімається разом зі своїм рахунком на оплату: рахунок
      // отримує «скасовано ким і коли» (§5), запис лишається.
      const d = state.rent.drafts.find((x) => x.id === action.id)
      const s = tick(state)
      let rent: Rent = { ...s.rent, drafts: s.rent.drafts.filter((x) => x.id !== action.id) }
      if (d?.invoiceId) {
        const inv = rent.invoices.find((i) => i.id === d.invoiceId)
        rent = {
          ...rent,
          invoices: rent.invoices.map((i) =>
            i.id === d.invoiceId ? { ...i, cancelled: { by: MANAGER.name, at: stamp(s) } } : i,
          ),
        }
        rent = withEvent(rent, s, {
          kind: 'invoice-cancel',
          text: `Рахунок на оплату ${inv?.number ?? 'без №'} скасовано разом зі способом`,
        })
      }
      return { ...s, rent }
    }

    case 'INVOICE_ISSUE': {
      const s = tick(state)
      const rate = rentVatRate(s.rent)
      const id = `inv-${s.seq}`
      const vatRate = action.group === 'deposit' ? 0 : rate
      const invoice: PaymentInvoice = {
        id,
        number: null,
        auto1c: true,
        createdAt: stamp(s),
        createdBy: MANAGER.name,
        group: action.group,
        amount: action.amount,
        vatRate,
        lines: action.lines ?? invoiceLines(s.rent, action.group, action.amount),
      }
      let rent: Rent = { ...s.rent, invoices: [...s.rent.invoices, invoice] }
      if (action.draftId) {
        rent = {
          ...rent,
          drafts: rent.drafts.map((d) => (d.id === action.draftId ? { ...d, invoiceId: id } : d)),
        }
      }
      rent = withEvent(rent, s, {
        kind: 'invoice',
        text: `Сформовано рахунок на оплату на ${formatMoney(action.amount)}`,
      })
      return { ...s, rent }
    }

    case 'BANK_REQUEST': {
      const s = tick(state)
      const draftId = `draft-${s.seq}`
      const draft: Draft = {
        id: draftId,
        method: 'bank',
        cashboxId: action.cashboxId,
        amount: action.amount,
        target: action.target,
      }
      const withDraft: State = { ...s, rent: { ...s.rent, drafts: [...s.rent.drafts, draft] } }
      return reducer(withDraft, { type: 'INVOICE_ISSUE', draftId, group: action.group, amount: action.amount })
    }

    case 'ACCEPT': {
      if (state.failNextSave) {
        return {
          ...state,
          failNextSave: false,
          lastError: 'Прийом не збережено: сервер не відповів. Гроші не записані — повторіть.',
        }
      }
      const s = tick(state)
      const bal = balanceOf(s.rent)
      const items = action.items ?? (action.target ? itemsOfTarget(action.target, bal) : undefined)
      const { cover } = allocate(bal, action.amount, items)
      const box = cashboxOf(action.cashboxId)
      // ПКО: будь-який рух через касу ФОПа. Баланс і розрахунковий
      // рахунок юрособи ордера не мають.
      const issuesPko = action.method !== 'balance' && !!box && !box.orgAccount
      const id = `pay-${s.seq}`
      const payment: Payment = {
        id,
        method: action.method,
        cashboxId: action.method === 'balance' ? null : action.cashboxId,
        amount: action.amount,
        cover,
        at: stamp(s),
        by: MANAGER.name,
        doc: issuesPko ? { number: null, auto1c: true } : null,
        invoiceId: action.invoiceId,
        source: 'crm',
      }
      let rent: Rent = {
        ...s.rent,
        payments: [...s.rent.payments, payment],
        drafts: action.draftId ? s.rent.drafts.filter((d) => d.id !== action.draftId) : s.rent.drafts,
      }
      if (action.method === 'balance') {
        rent = {
          ...rent,
          counterparty: { ...rent.counterparty, wallet: rent.counterparty.wallet - action.amount },
        }
      }
      const where = box ? ` — ${box.name}` : ''
      rent = withEvent(rent, s, {
        kind: 'payment',
        paymentId: id,
        text:
          action.method === 'bank'
            ? `Підтверджено надходження ${formatMoney(action.amount)} за квитанцією${where}`
            : `Прийнято ${formatMoney(action.amount)} ${METHOD_INSTR[action.method]}${where}`,
      })
      return { ...s, rent, lastError: null }
    }

    case 'ASSIGN_NUMBERS': {
      let s = state
      let rent = s.rent
      let changed = false
      const payments = rent.payments.map((p) => {
        if (p.doc && p.doc.number == null && p.doc.auto1c && !p.annulled) {
          changed = true
          const number = `ПКО-${String(s.nextPko).padStart(6, '0')}`
          s = { ...s, nextPko: s.nextPko + 1 }
          return { ...p, doc: { ...p.doc, number } }
        }
        return p
      })
      const invoices = rent.invoices.map((i) => {
        if (i.number == null && i.auto1c && !i.cancelled) {
          changed = true
          const number = `Р-${String(s.nextInvoice).padStart(6, '0')}`
          s = { ...s, nextInvoice: s.nextInvoice + 1 }
          return { ...i, number }
        }
        return i
      })
      if (!changed) return state
      rent = { ...rent, payments, invoices }
      return { ...s, rent }
    }

    case 'ANNUL': {
      const s = tick(state)
      const p = s.rent.payments.find((x) => x.id === action.paymentId)
      if (!p || p.annulled) return state
      let rent: Rent = {
        ...s.rent,
        payments: s.rent.payments.map((x) =>
          x.id === p.id ? { ...x, annulled: { by: MANAGER.name, at: stamp(s) } } : x,
        ),
      }
      if (p.method === 'balance') {
        rent = { ...rent, counterparty: { ...rent.counterparty, wallet: rent.counterparty.wallet + p.amount } }
      }
      rent = withEvent(rent, s, {
        kind: 'annul',
        paymentId: p.id,
        text: `Сторно ${formatMoney(p.amount)}: ${p.doc?.number ?? 'платіж'} анульовано`,
      })
      return { ...s, rent }
    }

    case 'CHARGE_ADD': {
      const s = tick(state)
      const charge: Charge = {
        id: `ch-${s.seq}`,
        kind: action.kind,
        article: action.article,
        target: action.target,
        net: action.net,
        vatable: action.vatable,
        comment: action.comment,
        createdAt: stamp(s),
        createdBy: MANAGER.name,
      }
      let rent: Rent = { ...s.rent, charges: [...s.rent.charges, charge] }
      rent = withEvent(rent, s, {
        kind: 'charge',
        text:
          action.kind === 'discount'
            ? `Знижка ${formatMoney(action.net)}: ${action.article}`
            : `Нараховано: ${action.article} ${formatMoney(gross(action.net, action.vatable ? rentVatRate(rent) : 0))}`,
      })
      return { ...s, rent }
    }

    case 'CHARGE_CANCEL': {
      const s = tick(state)
      const c = s.rent.charges.find((x) => x.id === action.id)
      let rent: Rent = {
        ...s.rent,
        charges: s.rent.charges.map((x) =>
          x.id === action.id ? { ...x, cancelled: { reason: action.reason, by: MANAGER.name, at: stamp(s) } } : x,
        ),
      }
      rent = withEvent(rent, s, {
        kind: 'charge-cancel',
        text: `Скасовано: ${c?.article ?? 'нарахування'} — ${action.reason}`,
      })
      return { ...s, rent }
    }

    case 'ALLOW_HANDOVER': {
      const s = tick(state)
      let rent: Rent = { ...s.rent, handoverAllowed: { by: 'Керівник мережі', at: stamp(s) } }
      rent = withEvent(rent, s, { kind: 'allow-handover', who: 'Керівник мережі', text: 'Дозволено видачу з боргом' })
      return { ...s, rent }
    }

    case 'HANDOVER': {
      const s = tick(state)
      let rent: Rent = { ...s.rent, handedOver: true }
      rent = withEvent(rent, s, { kind: 'handover', text: 'Оренду передано до видачі' })
      return { ...s, rent }
    }

    case 'SET_FAIL_NEXT':
      return { ...state, failNextSave: action.value }

    case 'CLEAR_ERROR':
      return { ...state, lastError: null }
  }
}

/** Рядки рахунку на оплату. Юрособа: «послуга оренди <номенклатура>». */
function invoiceLines(rent: Rent, group: PaymentInvoice['group'], amount: number) {
  const names = rent.positions.map((p) => p.name).join(', ')
  if (group === 'deposit') return [{ name: `Заставний платіж за ${names}`, amount }]
  if (group === 'charges') {
    const live = rent.charges.filter((c) => c.kind === 'charge' && !c.cancelled)
    return [{ name: live.map((c) => c.article).join(', ') || 'Доп. нарахування', amount }]
  }
  if (group === 'all') return [{ name: `Послуги оренди: ${names}`, amount }]
  return [{ name: `Послуга оренди ${names}`, amount }]
}

const INITIAL: State = {
  rent: undefined as unknown as Rent,
  minutes: START_MINUTES,
  nextPko: 181,
  nextInvoice: 214,
  seq: 1,
  failNextSave: false,
  lastError: null,
}

interface StoreValue {
  rent: Rent
  now: string
  lastError: string | null
  failNextSave: boolean
  dispatch: (a: Action) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ initial, children }: { initial: Rent; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL, rent: initial })

  /**
   * Номер з 1С повертається за кілька секунд (§5). Поки не прийшов —
   * «№ очікується від 1С», друк недоступний. Таймер знімається, щойно
   * чекати нема чого.
   */
  const waiting =
    state.rent.payments.some((p) => p.doc && p.doc.number == null && p.doc.auto1c && !p.annulled) ||
    state.rent.invoices.some((i) => i.number == null && i.auto1c && !i.cancelled)
  useEffect(() => {
    if (!waiting) return
    const t = window.setTimeout(() => dispatch({ type: 'ASSIGN_NUMBERS' }), ONE_C_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [waiting, state.rent.payments.length, state.rent.invoices.length])

  // Для прогону: сцену перевіряють за грошима, а не за картинкою.
  useEffect(() => {
    ;(window as unknown as { __intake: unknown }).__intake = {
      rent: state.rent,
      balance: balanceOf(state.rent),
    }
  }, [state.rent])

  const value = useMemo<StoreValue>(
    () => ({
      rent: state.rent,
      now: hhmm(state.minutes),
      lastError: state.lastError,
      failNextSave: state.failNextSave,
      dispatch,
    }),
    [state],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/** Затримка відповіді 1С. Прогін може її скоротити через `?onec=…`. */
export const ONE_C_DELAY_MS = (() => {
  if (typeof window === 'undefined') return 2500
  const v = Number(new URLSearchParams(window.location.search).get('onec'))
  return Number.isFinite(v) && v > 0 ? v : 2500
})()

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
