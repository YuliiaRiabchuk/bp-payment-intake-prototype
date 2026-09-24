import { ARTICLE_BY_ID } from './expense-articles'
import { days } from '@/lib/plural'
import type { Rent } from './types'

/**
 * Фінансові рухи по оренді — те, з чого склалась сума.
 *
 * Види проводок узяті з CRM (`LEDGER_KIND_LABELS` у `RentSummaryRail`), щоб
 * менеджер бачив у прототипі ті самі слова, що й у системі. Додано `REVERSAL`
 * і `RECALC`: сторно і перерахунок бізнес називає окремо, а без них таблиця
 * не відповідає на «чому сума змінилась».
 *
 * Рухи не зберігаються — вони ВИВОДЯТЬСЯ зі стану оренди. Так вони не можуть
 * розійтися з тим, що показує решта екрана: одне джерело, два прочитання.
 */

export type MovementKind =
  | 'ACCRUAL'
  | 'PAYMENT_IN'
  | 'DEPOSIT_IN'
  | 'SURCHARGE'
  | 'DISCOUNT'
  | 'REVERSAL'
  | 'RECALC'
  | 'DEPOSIT_OFFSET'
  | 'DEPOSIT_WITHHOLD'

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  ACCRUAL: 'Нарахування оренди',
  PAYMENT_IN: 'Оплата оренди',
  DEPOSIT_IN: 'Застава внесена',
  SURCHARGE: 'Доп. нарахування',
  DISCOUNT: 'Знижка',
  REVERSAL: 'Сторно',
  RECALC: 'Перерахунок',
  DEPOSIT_OFFSET: 'Закрито із застави',
  DEPOSIT_WITHHOLD: 'Утримано із застави',
}

/** Групи фільтра — по них менеджер шукає, коли клієнт сперечається. */
export type MovementGroup = 'charges' | 'payments' | 'corrections'

export const MOVEMENT_GROUP: Record<MovementKind, MovementGroup> = {
  ACCRUAL: 'charges',
  SURCHARGE: 'charges',
  PAYMENT_IN: 'payments',
  DEPOSIT_IN: 'payments',
  // Дві сторони одного утримання. По оренді це надходження (борг закрито),
  // по заставі — списання. Кожна сторона живе на своєму рахунку, і саме тому
  // підсумки сходяться: раніше одна проводка стояла на двох рахунках і
  // «Застава прийнята» показувала 2 600 замість внесених 5 000.
  DEPOSIT_OFFSET: 'payments',
  DEPOSIT_WITHHOLD: 'charges',
  DISCOUNT: 'corrections',
  REVERSAL: 'corrections',
  RECALC: 'corrections',
}

export const GROUP_LABEL: Record<MovementGroup, string> = {
  charges: 'Нарахування',
  payments: 'Оплати',
  corrections: 'Коригування',
}

export interface Movement {
  id: string
  kind: MovementKind
  at: string
  /** Що саме сталось — стаття, позиція, призначення платежу. */
  detail: string
  /** Документ, якщо він є. Проводки без паперу його не мають. */
  document?: string
  /** Знак важливий: «+» збільшує борг клієнта, «−» зменшує. */
  amount: number
  /** Позиція оренди, якщо рух стосується конкретної одиниці. */
  positionId?: string | null
  /** Скасована проводка лишається в таблиці закресленою. */
  cancelled?: boolean
  /**
   * Рахунок, до якого належить проводка.
   *
   * Оренда і застава — два рахунки, які НІКОЛИ не сумуються (інваріант
   * фінмоделі). Тому кожен рух знає свій рахунок, а підсумки рахуються
   * окремо: інакше в сайдбарі виникає «нараховано 3 600, прийнято 6 200» і
   * менеджер шукає зайві 2 600, яких немає.
   */
  account: 'rent' | 'deposit'
}

/**
 * Зібрати рухи з поточного стану оренди.
 *
 * Порядок хронологічний: спершу те, чим оренда відкрилась, далі життя.
 */
export function movementsOf(rent: Rent): Movement[] {
  const out: Movement[] = []

  // Базове нарахування і знижка — з рядків рахунку оренди.
  for (const line of rent.rentInvoice.lines) {
    out.push({
      id: `mv-${line.id}`,
      kind: line.kind === 'discount' ? 'DISCOUNT' : 'ACCRUAL',
      at: rent.issueAt,
      detail:
        line.kind === 'discount'
          ? 'Знижка за домовленістю'
          : `${line.label} — ${days(rent.plannedDays)}`,
      amount: line.amount,
      account: 'rent',
    })
  }

  // Початкові платежі.
  for (const p of rent.payments) {
    if (p.forSurchargeId) continue
    const at = p.at ?? rent.issueAt
    // Один документ на два рахунки дає два рядки з одним номером. Так у
    // книзі видно і папір, і те, куди насправді лягли гроші.
    type Part = { account: Movement['account']; amount: number; note: string }
    const split: Part[] = p.allocation
      ? [
          { account: 'rent', amount: p.allocation.rent, note: 'Оренда' },
          { account: 'deposit', amount: p.allocation.deposit, note: 'Застава' },
        ]
      : [
          {
            account: p.cashbox.toLowerCase().includes('застав') ? 'deposit' : 'rent',
            amount: p.amount,
            note: '',
          },
        ]
    const parts = split.filter((x) => x.amount > 0)

    for (const part of parts) {
      out.push({
        id: `mv-${p.id}-${part.account}`,
        kind: part.account === 'deposit' ? 'DEPOSIT_IN' : 'PAYMENT_IN',
        account: part.account,
        at,
        // Розбитий ПКО не переказує своє призначення в кожному рядку: суми
        // вже стоять у колонці, а повний текст залишається при документі.
        detail: [part.note || p.purpose, p.cashbox].filter(Boolean).join(' — '),
        document: p.document,
        amount: -part.amount,
      })
    }
  }

  // Нарахування, доплати, прострочення.
  for (const s of rent.surcharges) {
    const article = s.articleId ? ARTICLE_BY_ID.get(s.articleId) : undefined
    const detail =
      s.kind === 'overdue'
        ? 'Прострочення — утримується із застави'
        : s.kind === 'extension'
          ? 'Продовження строку' + (s.source === 'client' ? ', клієнт зі свого телефона' : '')
          : (article?.name ?? 'Доп. нарахування') + (s.comment ? ` — ${s.comment}` : '')

    out.push({
      id: `mv-${s.id}`,
      kind: 'SURCHARGE',
      account: 'rent',
      at: s.createdAt,
      detail,
      positionId: s.positionId,
      amount: s.amount,
      cancelled: s.status === 'cancelled',
    })

    // Прострочення не платять окремо — його утримують. Це два рухи, а не
    // один: борг по оренді закривається, застава на ту саму суму меншає.
    if (s.kind === 'overdue' && s.status !== 'cancelled') {
      out.push({
        id: `mv-${s.id}-off`,
        kind: 'DEPOSIT_OFFSET',
        account: 'rent',
        at: s.createdAt,
        detail: 'Прострочення закрито із застави',
        amount: -s.amount,
      })
      out.push({
        id: `mv-${s.id}-wh`,
        kind: 'DEPOSIT_WITHHOLD',
        account: 'deposit',
        at: s.createdAt,
        detail: 'Утримано в рахунок прострочення',
        amount: s.amount,
      })
    }

    // Скасоване нарахування дає СТОРНО окремим рядком: у таблиці рухів
    // відміна це подія, а не зникнення рядка.
    if (s.status === 'cancelled') {
      out.push({
        id: `mv-${s.id}-rev`,
        kind: 'REVERSAL',
        account: 'rent',
        at: s.createdAt,
        detail: `Сторно: ${detail}`,
        amount: -s.amount,
      })
    }

    // Закрите нарахування дає платіж із документом.
    const settlement = rent.payments.find((p) => p.forSurchargeId === s.id)
    if (settlement) {
      out.push({
        id: `mv-${settlement.id}`,
        kind: 'PAYMENT_IN',
        account: 'rent',
        at: settlement.at ?? s.createdAt,
        detail: `${settlement.purpose ?? 'Доплата'} — ${settlement.cashbox}`,
        document: settlement.document,
        amount: -settlement.amount,
      })
    }
  }

  return out
}

/**
 * Підсумок рухів по ОДНОМУ рахунку.
 *
 * Викликати на змішаному наборі не можна: оренда і застава не сумуються.
 * Тому за замовчуванням береться рахунок оренди, а застава рахується окремим
 * викликом з `'deposit'`.
 */
export function movementTotals(
  rows: Movement[],
  account: Movement['account'] | 'all' = 'rent',
) {
  let charged = 0
  let paid = 0
  for (const r of rows) {
    if (r.cancelled) continue
    if (account !== 'all' && r.account !== account) continue
    // Розділяє ГРУПА, а не знак. Знижка теж відʼємна, але вона зменшує
    // нарахування, а не є внесеними грошима: за знаком вона потрапляла у
    // «прийнято» і роздувала його на суму знижки.
    if (MOVEMENT_GROUP[r.kind] === 'payments') paid += -r.amount
    else charged += r.amount
  }
  return { charged, paid, balance: charged - paid }
}

/**
 * Гроші оренди одним джерелом.
 *
 * Нараховане, прийняте і залишок мають рахуватись рівно в одному місці:
 * сайдбар, крок оплати, книга рухів і хронологія показують одну величину, а
 * не три схожі. Раніше кожен екран рахував сам — і на одній оренді виходило
 * «600», «1 200» і «3 000» під одним словом «нараховано».
 */
export function rentMoney(rent: Rent) {
  const t = movementTotals(movementsOf(rent), 'rent')
  return { accrued: t.charged, paid: t.paid, outstanding: t.charged - t.paid }
}
