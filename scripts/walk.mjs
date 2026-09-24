/**
 * Прогін прототипу прийому коштів: 12 сцен §8 × варіанти кроку.
 *
 * Сцена — спільний для всіх варіантів сценарій над грошима («прийняти все
 * готівкою», «оренду готівкою, заставу терміналом»). ДРАЙВЕР варіанта знає,
 * куди в ньому клікати. Результат перевіряється за станом стору
 * (`window.__intake`), а не за картинкою.
 *
 * Виміри §10 знімаються після кожного кліку:
 *  - кліки в сценах 1, 2, 5;
 *  - максимальний вертикальний зсув головної дії (`[data-main-action=intake]`)
 *    і верху кроку (`[data-step=intake]`) між сусідніми кліками, у px
 *    координат вмісту (незалежно від прокрутки);
 *  - скільки поверхонь друкують «скільки ще прийняти» (`[data-remaining]`,
 *    видимі одночасно; максимум за сцену);
 *  - скільки різних станів має один поповер (`[data-popover-id]`; стан —
 *    текст без чисел; максимум серед поповерів варіанта).
 * Плюс: горизонтальний скрол і видимість головної дії без прокрутки на
 * 1366×768.
 *
 * Запуск (при `npm run dev`):
 *   node scripts/walk.mjs [--variants 0,A,B,C,D] [--rail 0] [--url …] [--shots] [--json out.json]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = argOf('--url', 'http://localhost:5173/bp-payment-intake-prototype/')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = process.argv.includes('--shots')
const JSON_OUT = argOf('--json', null)
const VARIANTS = argOf('--variants', '0').split(',')
const RAIL = argOf('--rail', '0')
const W = 1366
const H = 768

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
const fails = []
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fails.push(`${name}${detail ? ` (${detail})` : ''}`)
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `  (${detail})` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: W, height: H },
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

/* ── Вимір стану ───────────────────────────────────────────────────── */

async function measure() {
  return page.evaluate(() => {
    const box = document.querySelector('[data-testid="card-scroll"]')
    const st = box ? box.scrollTop : 0
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      const cs = getComputedStyle(el)
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
    }
    const main = [...document.querySelectorAll('[data-main-action="intake"]')].filter(vis)[0]
    const step = document.querySelector('[data-step="intake"]')
    const pops = [...document.querySelectorAll('[data-popover-id]')]
      .filter(vis)
      .map((p) => ({
        id: p.getAttribute('data-popover-id'),
        sig: p.innerText.replace(/[−-]?\d[\d\s  ,.]*/g, '#').replace(/\s+/g, ' ').trim(),
        h: Math.round(p.getBoundingClientRect().height),
      }))
    const rem = [...new Set([...document.querySelectorAll('[data-remaining]')].filter(vis).map((e) => e.getAttribute('data-remaining')))]
    return {
      main: main ? Math.round(main.getBoundingClientRect().top + st) : null,
      mainLabel: main ? main.innerText.replace(/\s+/g, ' ').trim().slice(0, 40) : null,
      step: step ? Math.round(step.getBoundingClientRect().top + st) : null,
      pops,
      rem,
    }
  })
}

const intake = () => page.evaluate(() => window.__intake)

/* ── Прогін однієї сцени ───────────────────────────────────────────── */

class Run {
  constructor(variant, scene) {
    this.variant = variant
    this.scene = scene
    this.clicks = 0
    this.states = []
  }
  async snap() {
    await sleep(340)
    this.states.push(await measure())
  }
  async click(sel, { count = true } = {}) {
    const el = await page.waitForSelector(sel, { visible: true, timeout: 5000 })
    await el.click()
    if (count) this.clicks++
    await this.snap()
  }
  /** Клік за текстом кнопки всередині селектора. */
  async clickText(sel, text, opts) {
    const handle = await page.waitForFunction(
      (s, t) => [...document.querySelectorAll(s)].find((n) => n.textContent.replace(/\s+/g, ' ').includes(t) && n.getBoundingClientRect().width > 0),
      { timeout: 5000 },
      sel,
      text,
    )
    const el = handle.asElement()
    await el.click()
    if (opts?.count !== false) this.clicks++
    await this.snap()
  }
  async type(sel, value) {
    const el = await page.waitForSelector(sel, { visible: true, timeout: 5000 })
    await el.click()
    this.clicks++
    // Сума з нерозривним пробілом: виділяємо все клавіатурою, як менеджер.
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await el.type(String(value))
    await page.keyboard.press('Enter')
    await this.snap()
  }
  metrics() {
    let mainShift = 0
    let stepShift = 0
    for (let i = 1; i < this.states.length; i++) {
      const a = this.states[i - 1]
      const b = this.states[i]
      if (a.main != null && b.main != null) mainShift = Math.max(mainShift, Math.abs(b.main - a.main))
      if (a.step != null && b.step != null) stepShift = Math.max(stepShift, Math.abs(b.step - a.step))
    }
    const surfaces = Math.max(0, ...this.states.map((s) => s.rem.length))
    const worst = this.states.find((s) => s.rem.length === surfaces)?.rem ?? []
    const pops = new Map()
    for (const s of this.states) for (const p of s.pops) {
      if (!pops.has(p.id)) pops.set(p.id, { sigs: new Set(), hs: new Set() })
      pops.get(p.id).sigs.add(p.sig)
      pops.get(p.id).hs.add(Math.round(p.h / 4))
    }
    return { clicks: this.clicks, mainShift, stepShift, surfaces, worst, pops }
  }
}

async function open(variant, scene, { party, role = 'manager' } = {}) {
  const q = new URLSearchParams({ v: variant, rail: RAIL, scene, stage: 'payment', role, lab: 'off', onec: '300' })
  if (party) q.set('party', party)
  await page.goto(`${BASE}?${q}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="card-scroll"]')
  await sleep(250)
  const run = new Run(variant, scene)
  await run.snap()
  return run
}

async function shot(name) {
  if (!SHOTS) return
  mkdirSync(`${OUT_DIR}`, { recursive: true })
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` })
}
let OUT_DIR = 'shots'

/* ── Драйвери варіантів ────────────────────────────────────────────── */

/**
 * Драйвер знає лише ДЕ клікати в своєму варіанті. Що зробити — вирішує
 * сценарій сцени, однаковий для всіх.
 */
const DRIVERS = {
  '0': {
    async openRow(run) {
      if (await page.$('[data-testid="add-method-block"]')) await run.click('[data-testid="add-method-block"]')
      else await run.click('[data-testid="add-method-row"]')
    },
    async setup(run, method, cashbox) {
      await run.click(`[data-testid="method-radio-${method}"]`)
      if (cashbox) {
        if (await page.$('[data-testid="setup-change-dest"]')) await run.click('[data-testid="setup-change-dest"]')
        await run.click(`[data-testid="cashbox-option-${cashbox}"]`)
      }
      await run.click('[data-testid="setup-done"]')
    },
    async preset(run, key) {
      const sel = `[data-testid="preset-${key}"]`
      if (await page.$(sel)) await run.click(sel)
      else await run.click('[data-testid="preset-all"]')
    },
    async accept(run) {
      await run.click('[data-testid^="accept-"]')
      await sleep(250)
    },
    async payAll(run, method = 'cash', { cashbox } = {}) {
      await this.openRow(run)
      await this.setup(run, method, cashbox)
      await this.preset(run, 'all')
      await this.accept(run)
    },
    async payGroup(run, group, method) {
      await this.openRow(run)
      await this.setup(run, method)
      await this.preset(run, group)
      await this.accept(run)
    },
    async payAmount(run, amount, method) {
      await this.openRow(run)
      await this.setup(run, method)
      await run.type('[data-testid^="amount-draft"]', amount)
      await this.accept(run)
    },
    async bank(run) {
      await this.openRow(run)
      await run.click('[data-testid="method-radio-bank"]')
      await run.click('[data-testid="cashbox-option-cb-bank-1"]')
      await run.click('[data-testid="setup-done"]')
      await this.preset(run, 'all')
      await run.click('[data-testid="copy-all"]')
      await this.accept(run)
    },
    async confirmPending(run) {
      // Чернетка переказу налаштована вчора. Рядок з незавершеною дією
      // відкривається сам (рішення 30.07); якщо ні — розгорнути.
      const visible = await page.$('[data-testid^="accept-"]')
      const box = visible && (await visible.boundingBox())
      if (!box || box.height === 0) await run.click('[data-draft] button[aria-label="Показати кроки способу"]')
      await this.accept(run)
    },
    async handover(run) {
      await run.click('[data-testid="to-handover"]')
    },
  },

  /* A: спосіб явно в рядку, каса — чип, «Покриває» — поповер з галочками. */
  A: {
    async payAll(run, method = 'cash', { cashbox } = {}) {
      await run.click(`[data-testid="method-${method}"]`)
      if (cashbox) {
        await run.click('[data-testid="cashbox-chip"]')
        await run.click(`[data-testid="cashbox-option-${cashbox}"]`)
      }
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async payGroup(run, group, method) {
      await run.click(`[data-testid="method-${method}"]`)
      const other = group === 'rent' ? 'deposit' : 'rent'
      const words = await page.$eval('[data-testid="cover-trigger"]', (b) => b.textContent).catch(() => '')
      if ((other === 'deposit' && /застава/.test(words)) || (other === 'rent' && /оренда/.test(words))) {
        await run.click('[data-testid="cover-trigger"]')
        await run.click(`[data-testid="cover-${other}"]`)
      }
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async payAmount(run, amount, method) {
      await run.click(`[data-testid="method-${method}"]`)
      await run.type('[data-testid="amount"]', amount)
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async bank(run) {
      await run.click('[data-testid="method-bank"]')
      await run.click('[data-testid="copy-all"]')
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async confirmPending(run) {
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async handover(run) {
      await run.click('[data-testid="to-handover"]')
    },
  },

  /* B: список з галочками — склад платежу; рядок прийому під ним. */
  B: {
    async method(run, m) {
      const on = await page.$eval(`[data-testid="method-${m}"]`, (b) => b.getAttribute('aria-checked') === 'true').catch(() => false)
      if (!on) await run.click(`[data-testid="method-${m}"]`)
    },
    async payAll(run, method = 'cash', { cashbox } = {}) {
      await this.method(run, method)
      if (cashbox) {
        await run.click('[data-testid="cashbox-chip"]')
        await run.click(`[data-testid="cashbox-option-${cashbox}"]`)
      }
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async payGroup(run, group, method) {
      const other = group === 'rent' ? 'deposit' : 'rent'
      const checked = await page.$eval(`[data-testid="pick-${other}"]`, (b) => b.getAttribute('data-state') === 'checked').catch(() => false)
      if (checked) await run.click(`[data-testid="pick-${other}"]`)
      await this.method(run, method)
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async payAmount(run, amount, method) {
      await this.method(run, method)
      await run.type('[data-testid="amount"]', amount)
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async bank(run) {
      await this.method(run, 'bank')
      await run.click('[data-testid="copy-all"]')
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async confirmPending(run) {
      await run.click('[data-testid^="confirm-draft"]')
      await sleep(250)
    },
    async handover(run) {
      await run.click('[data-testid="to-handover"]')
    },
  },

  /* C: панель каси з табами і пресетами, дія внизу панелі. */
  C: {
    async method(run, m) {
      const on = await page.$eval(`[data-testid="method-${m}"]`, (b) => b.getAttribute('aria-checked') === 'true').catch(() => false)
      if (!on) await run.click(`[data-testid="method-${m}"]`)
    },
    async payAll(run, method = 'cash', { cashbox } = {}) {
      await this.method(run, method)
      if (cashbox) {
        await run.click('[data-testid="cashbox-chip"]')
        await run.click(`[data-testid="cashbox-option-${cashbox}"]`)
      }
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async payGroup(run, group, method) {
      const n = await page.evaluate(() => document.querySelectorAll('[data-testid^="preset-"]').length)
      if (n > 2) await run.click(`[data-testid="preset-${group}"]`)
      await this.method(run, method)
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async payAmount(run, amount, method) {
      await this.method(run, method)
      await run.type('[data-testid="amount"]', amount)
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async bank(run) {
      await this.method(run, 'bank')
      await run.click('[data-testid="copy-all"]')
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async confirmPending(run) {
      await run.click('[data-testid="accept"]')
      await sleep(250)
    },
    async handover(run) {
      await run.click('[data-testid="to-handover"]')
    },
  },

  /* D: речення + ряд дій; «Розділити» для кількох платежів; переказ — бокова панель. */
  D: {
    async payAll(run, method = 'cash', { cashbox } = {}) {
      if (cashbox) {
        await run.click('[data-testid="cashbox-chip"]')
        await run.click(`[data-testid="cashbox-option-${cashbox}"]`)
      }
      if (method === 'bank') {
        await run.click('[data-testid="quick-bank"]')
        await run.click('[data-testid="bank-confirm"]')
      } else await run.click(`[data-testid="quick-${method}"]`)
      await sleep(250)
    },
    async split(run, plan) {
      await run.click('[data-testid="quick-split"]')
      for (const [group, method] of plan) {
        const on = await page.$eval(`[data-testid="split-${group}-${method}"]`, (b) => b.getAttribute('aria-checked') === 'true').catch(() => false)
        if (!on) await run.click(`[data-testid="split-${group}-${method}"]`)
      }
      await run.click('[data-testid="split-accept"]')
      await sleep(250)
    },
    async payGroup(run, group, method) {
      await this.split(run, [[group, method]])
    },
    async payAmount(run, amount, method) {
      if (method === 'balance') {
        await run.click('[data-testid="quick-balance"]')
        await sleep(250)
        return
      }
      await run.click('[data-testid="sentence-amount"]')
      await page.keyboard.type(String(amount))
      await page.keyboard.press('Enter')
      await run.snap()
      await run.click(`[data-testid="quick-${method}"]`)
      await sleep(250)
    },
    async bank(run) {
      await run.click('[data-testid="quick-bank"]')
      await run.click('[data-testid="copy-all"]')
      await run.click('[data-testid="bank-confirm"]')
      await sleep(250)
    },
    async confirmPending(run) {
      await run.click('[data-testid^="confirm-draft"]')
      await sleep(250)
    },
    async handover(run) {
      await run.click('[data-testid="to-handover"]')
    },
  },
}

/** Сторно з хронології — спільне для всіх варіантів (§5). */
async function annulLatest(run) {
  await run.click('[data-testid="open-timeline"]')
  await run.click('[data-testid^="annul-pay"]')
  await run.click('[data-testid="annul-submit"]')
  await page.keyboard.press('Escape')
  await sleep(200)
}

/* ── Сценарії сцен ─────────────────────────────────────────────────── */

const SCENES = [
  {
    id: 'queue',
    n: 1,
    measure: true,
    async play(d, run) {
      await d.payAll(run, 'cash')
    },
    async check(s) {
      return s.balance.remaining === 0 && s.rent.payments.length === 1 && s.rent.payments[0].method === 'cash'
    },
  },
  {
    id: 'split',
    n: 2,
    measure: true,
    async play(d, run) {
      if (d.split) await d.split(run, [['rent', 'cash'], ['deposit', 'terminal']])
      else {
        await d.payGroup(run, 'rent', 'cash')
        await d.payGroup(run, 'deposit', 'terminal')
      }
    },
    async check(s) {
      const [a, b] = s.rent.payments
      return (
        s.balance.remaining === 0 &&
        a?.method === 'cash' && a.cover.rent === 2100 && a.cover.deposit === 0 &&
        b?.method === 'terminal' && b.cover.deposit === 3000
      )
    },
  },
  {
    id: 'transfer-fl',
    n: 3,
    async play(d, run) {
      await d.bank(run)
    },
    async check(s) {
      const p = s.rent.payments[0]
      return s.balance.remaining === 0 && p?.method === 'bank' && !!p.doc && s.rent.invoices.length === 0
    },
  },
  {
    id: 'legal',
    n: 4,
    async play(d, run) {
      await d.confirmPending(run)
    },
    async check(s) {
      return s.balance.deposit.remaining === 0 && s.balance.shortfall1c === 120 && s.balance.remaining === 120
    },
  },
  {
    id: 'charge-after',
    n: 5,
    measure: true,
    async play(d, run) {
      await d.payAll(run, 'cash')
    },
    async check(s) {
      const last = s.rent.payments[s.rent.payments.length - 1]
      return s.balance.remaining === 0 && last.cover.charges['ch-delivery'] === 1000 && last.cover.rent === 0
    },
  },
  {
    id: 'partial',
    n: 6,
    async before(d, variant) {
      // Та сама оренда без оплати: менеджер не проходить, керівник бачить «Пропустити оплату».
      await open(variant, 'partial')
      const blocked = await page.$eval('[data-testid="to-handover"]', (b) => b.disabled).catch(() => null)
      const skipForManager = !!(await page.$('[data-testid="skip-payment"]'))
      await open(variant, 'partial', { role: 'head' })
      const skipForHead = !!(await page.$('[data-testid="skip-payment"]'))
      return { blocked, skipForManager, skipForHead }
    },
    async play(d, run) {
      await d.payAmount(run, 3000, 'cash')
      await d.handover(run)
    },
    async check(s, pre) {
      return (
        pre.blocked === true && !pre.skipForManager && pre.skipForHead &&
        s.balance.remaining === 2100 && s.rent.handedOver === true
      )
    },
  },
  {
    id: 'balance',
    n: 7,
    async play(d, run) {
      await d.payAmount(run, 1500, 'balance')
      await d.payAll(run, 'cash')
    },
    async check(s) {
      const [a, b] = s.rent.payments
      return s.balance.remaining === 0 && a?.method === 'balance' && a.amount === 1500 && b?.method === 'cash' && b.amount === 3600
    },
  },
  {
    id: 'reversal',
    n: 8,
    async play(d, run) {
      await annulLatest(run)
      await d.payAll(run, 'terminal')
    },
    async check(s) {
      const annulled = s.rent.payments.filter((p) => p.annulled)
      const live = s.rent.payments.filter((p) => !p.annulled)
      const ev = s.rent.events.filter((e) => e.kind === 'annul' || e.kind === 'payment')
      return s.balance.remaining === 0 && annulled.length === 1 && live[0]?.method === 'terminal' && ev.length >= 3
    },
  },
  {
    id: 'zero-deposit',
    n: 9,
    async play(d, run) {
      await d.payAll(run, 'cash')
      await d.handover(run)
      await page.waitForSelector('[data-testid="zero-deposit-dialog"]', { visible: true, timeout: 3000 })
      await run.click('[data-testid="zero-deposit-confirm"]')
    },
    async check(s) {
      return s.balance.remaining === 0 && s.rent.handedOver === true
    },
  },
  {
    id: 'from-1c',
    n: 10,
    async play() {},
    async check(s) {
      const text = await page.evaluate(() => document.body.innerText)
      const src = s.rent.payments.find((p) => p.source === '1c')
      const own = s.rent.payments.find((p) => p.source === 'crm' && p.doc && p.doc.number == null)
      return !!src && !!own && /1С/.test(text) && /№ очікується від 1С/.test(text)
    },
  },
  {
    id: 'discount',
    n: 11,
    async play() {},
    async check(s) {
      return s.balance.overpay === 500 && s.balance.remaining === 0
    },
  },
  {
    id: 'big',
    n: 12,
    async play(d, run) {
      await d.payAll(run, 'cash')
    },
    async check(s) {
      return s.balance.remaining === 0 && s.rent.positions.length === 4
    },
  },
]

/* ── Прогін ────────────────────────────────────────────────────────── */

const results = {}

for (const variant of VARIANTS) {
  const d = DRIVERS[variant]
  if (!d) {
    ok(`варіант ${variant}: є драйвер`, false)
    continue
  }
  console.log(`\n── Варіант ${variant} (сайдбар ${RAIL}) ──`)
  OUT_DIR = `shots/v${variant}`
  const r = (results[variant] = { scenes: {}, pops: {} })

  // 1366×768: горизонтальний скрол і головна дія без прокрутки.
  await open(variant, 'queue')
  const layout = await page.evaluate(() => {
    const doc = document.documentElement
    const box = document.querySelector('[data-testid="card-scroll"]')
    const main = [...document.querySelectorAll('[data-main-action="intake"]')][0]
    const rr = main?.getBoundingClientRect()
    return {
      hscroll: Math.max(doc.scrollWidth - doc.clientWidth, box ? box.scrollWidth - box.clientWidth : 0),
      mainVisible: !!rr && rr.top >= 0 && rr.bottom <= window.innerHeight,
      mainBottom: rr ? Math.round(rr.bottom) : null,
    }
  })
  r.layout = layout
  ok(`[${variant}] 1366×768 без горизонтального скролу`, layout.hscroll <= 0, `${layout.hscroll}px`)
  ok(`[${variant}] головну дію видно без прокрутки`, layout.mainVisible, `низ ${layout.mainBottom}px із ${H}`)
  await shot('01-queue-start')

  for (const sc of SCENES) {
    let pre = null
    if (sc.before) pre = await sc.before(d, variant)
    const run = await open(variant, sc.id)
    let error = null
    try {
      await sc.play(d, run)
      await sleep(500)
    } catch (e) {
      error = e.message.split('\n')[0]
    }
    const state = await intake()
    const passed = !error && (await sc.check(state, pre))
    ok(`[${variant}] сцена ${sc.n} ${sc.id}`, passed, error ?? '')
    await shot(`${String(sc.n).padStart(2, '0')}-${sc.id}`)
    const m = run.metrics()
    r.scenes[sc.id] = { n: sc.n, passed, error, ...m, pops: undefined, worst: m.worst }
    for (const [id, v] of m.pops) {
      if (!r.pops[id]) r.pops[id] = { sigs: new Set(), hs: new Set() }
      v.sigs.forEach((s) => r.pops[id].sigs.add(s))
      v.hs.forEach((h) => r.pops[id].hs.add(h))
    }
    if (sc.measure)
      console.log(
        `        кліки ${m.clicks}, зсув дії ${m.mainShift}px, зсув кроку ${m.stepShift}px, поверхонь «скільки ще» ${m.surfaces} [${m.worst.join(', ')}]`,
      )
  }

  // Зміна каси в сцені 1: скільки кліків додає.
  if (d.changeCashbox !== false) {
    const run = await open(variant, 'queue')
    try {
      if (d.payAllOtherCashbox) await d.payAllOtherCashbox(run)
      else await d.payAll(run, 'cash', { cashbox: 'cb-kur-2' })
      await sleep(300)
    } catch (e) {
      console.log('  зміна каси не пройшла:', e.message.split('\n')[0])
    }
    for (const [id, v] of run.metrics().pops) {
      if (!r.pops[id]) r.pops[id] = { sigs: new Set(), hs: new Set() }
      v.sigs.forEach((x) => r.pops[id].sigs.add(x))
      v.hs.forEach((x) => r.pops[id].hs.add(x))
    }
    const s = await intake()
    r.cashboxChange = { clicks: run.clicks, extra: run.clicks - r.scenes.queue.clicks, ok: s.rent.payments[0]?.cashboxId === 'cb-kur-2' }
    ok(`[${variant}] зміна каси з рядка`, r.cashboxChange.ok, `+${r.cashboxChange.extra} кліків`)
  }
}

/* ── Зведення ──────────────────────────────────────────────────────── */

console.log('\n| Варіант | Кліки 1 | Кліки 2 | Кліки 5 | Зміна каси | Зсув дії, px | Зсув кроку, px | Поверхонь «скільки ще» | Станів поповера | Сцен пройдено |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
const summary = {}
for (const [v, r] of Object.entries(results)) {
  const sc = r.scenes
  const measured = ['queue', 'split', 'charge-after'].map((k) => sc[k]).filter(Boolean)
  const mainShift = Math.max(0, ...measured.map((m) => m.mainShift))
  const stepShift = Math.max(0, ...measured.map((m) => m.stepShift))
  const surfaces = Math.max(0, ...Object.values(sc).map((m) => m.surfaces))
  const popStates = Object.entries(r.pops).map(([id, p]) => ({ id, states: p.sigs.size, heights: p.hs.size }))
  const worstPop = popStates.sort((a, b) => b.states - a.states)[0]
  const passed = Object.values(sc).filter((m) => m.passed).length
  summary[v] = {
    clicks1: sc.queue?.clicks,
    clicks2: sc.split?.clicks,
    clicks5: sc['charge-after']?.clicks,
    cashboxExtra: r.cashboxChange?.extra,
    mainShift,
    stepShift,
    surfaces,
    popStates: worstPop ? `${worstPop.states} (${worstPop.id})` : '0',
    popAll: popStates,
    passed: `${passed}/${Object.keys(sc).length}`,
    layout: r.layout,
  }
  const s = summary[v]
  console.log(
    `| ${v} | ${s.clicks1} | ${s.clicks2} | ${s.clicks5} | +${s.cashboxExtra} | ${s.mainShift} | ${s.stepShift} | ${s.surfaces} | ${s.popStates} | ${s.passed} |`,
  )
}

if (JSON_OUT) {
  const plain = JSON.parse(JSON.stringify(summary))
  writeFileSync(JSON_OUT, JSON.stringify({ rail: RAIL, summary: plain, scenes: Object.fromEntries(Object.entries(results).map(([v, r]) => [v, r.scenes])) }, null, 2))
}

await browser.close()
console.log(`\n${pass} ok, ${fails.length} fail`)
if (fails.length) {
  console.log(fails.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
