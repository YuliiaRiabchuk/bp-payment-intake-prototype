/**
 * Прогін прототипу прийому коштів.
 *
 * Етап 0: каркас. Перевіряє, що картка оренди відкривається, на 1366×768
 * немає горизонтального скролу, стан віджета пишеться в URL і відтворюється
 * посиланням, а Ctrl+. ховає віджет. Виміри §10 брифу (кліки, зсуви,
 * поверхні «скільки ще прийняти», стани поповера) додає етап 2.
 *
 * Запуск: node scripts/walk.mjs [--url http://localhost:5173/bp-payment-intake-prototype/] [--shots]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = argOf('--url', 'http://localhost:5173/bp-payment-intake-prototype/')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = process.argv.includes('--shots')
const OUT = 'shots'

let pass = 0
const fails = []
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fails.push(name)
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1366, height: 768 },
})
const page = await browser.newPage()
if (SHOTS) mkdirSync(OUT, { recursive: true })

/* ── 1. Картка відкривається ───────────────────────────────────────────── */
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="card-scroll"]', { timeout: 10000 })
ok('картка оренди відкривається', !!(await page.$('[data-testid="target-rail"]')))
ok('крок «Оплата» на екрані', !!(await page.$('[data-testid="payment-stage"]')))

/* ── 2. Горизонтальний скрол на 1366×768 ───────────────────────────────── */
const hscroll = await page.evaluate(() => {
  const doc = document.documentElement
  const box = document.querySelector('[data-testid="card-scroll"]')
  return {
    doc: doc.scrollWidth - doc.clientWidth,
    box: box ? box.scrollWidth - box.clientWidth : 0,
  }
})
ok('1366×768: немає горизонтального скролу', hscroll.doc <= 0 && hscroll.box <= 0, JSON.stringify(hscroll))

/* ── 3. Стан у URL ─────────────────────────────────────────────────────── */
const q = new URL(page.url()).searchParams
ok(
  'URL несе варіант, сайдбар, сцену, контрагента і роль',
  ['v', 'rail', 'scene', 'party', 'role'].every((k) => q.has(k)),
  q.toString(),
)
await page.goto(`${BASE}?v=0&rail=0&scene=legal&party=ul&role=head&stage=payment`, {
  waitUntil: 'networkidle0',
})
await page.waitForSelector('[data-testid="card-scroll"]')
const back = new URL(page.url()).searchParams
ok(
  'посилання відтворює кадр (сцена 4, юрособа, керівник)',
  back.get('scene') === 'legal' && back.get('party') === 'ul' && back.get('role') === 'head',
  back.toString(),
)

/* ── 4. Ctrl+. ховає віджет ────────────────────────────────────────────── */
const widgetBefore = await page.$('button[aria-label="Розгорнути перемикач кадрів"], [data-lab-widget]')
await page.keyboard.down('Control')
await page.keyboard.press('.')
await page.keyboard.up('Control')
await sleep(150)
const widgetAfter = await page.$('button[aria-label="Розгорнути перемикач кадрів"], [data-lab-widget]')
ok('Ctrl+. ховає віджет', !!widgetBefore && !widgetAfter)

if (SHOTS) await page.screenshot({ path: `${OUT}/stage0-card.png` })

await browser.close()
console.log(`\n${pass} ok, ${fails.length} fail`)
if (fails.length) {
  console.log(fails.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
