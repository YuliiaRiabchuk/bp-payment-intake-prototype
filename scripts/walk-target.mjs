/**
 * Прогін цільового рішення.
 *
 * Перевіряється не «чи є на екрані блок», а чи тримаються обіцянки:
 *   - посилання в сайдбарі є на КОЖНОМУ етапі і веде на «Оплату»;
 *   - точка редагування одна: форма живе тільки на кроці оплати;
 *   - дорога назад існує і повертає саме туди, звідки прийшли;
 *   - «немає блока, поки немає нарахувань» тримається для історії, але не
 *     для кнопки в сайдбарі;
 *   - друга форма не відкривається поверх незавершеної;
 *   - обидва кадри (рухи, хронологія) відкриваються і містять числа;
 *   - /variants лишається архівом і не є головною.
 *
 * Запуск: node scripts/walk-target.mjs [--shots]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

// Порт за замовчуванням той самий, який дає `npm run dev`. Раніше тут стояв
// 5179 — прогін не працював на свіжому клоні, хоча README радив саме
// `npm run dev`. Інший порт передається через `--url`.
const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = argOf('--url', 'http://localhost:5173/bp-1259-rent-payment-anytime-prototype/')
const CHROME =
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = process.argv.includes('--shots')
const OUT = 'shots/target'

let pass = 0
const fails = []
const ok = (name, cond) => {
  if (cond) pass++
  else fails.push(name)
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}`)
}

const STAGES = ['draft', 'payment', 'handover', 'active', 'closing']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Клік по видимому елементу з точним текстом. */
async function clickText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, txt) => {
      // ТОЧНИЙ збіг має пріоритет над входженням по всьому списку, а не в
      // межах одного вузла. Інакше «Скасувати» ловить «Скасувати
      // нарахування», якщо той рядок стоїть у DOM вище — на це вже
      // наступали, і воно спрацьовує лише в певних сценах.
      const nodes = [...document.querySelectorAll(sel)]
      return (
        nodes.find((n) => n.textContent.trim() === txt) ??
        nodes.find((n) => n.textContent.includes(txt))
      )
    },
    selector,
    text,
  )
  const el = handle.asElement()
  if (!el) return false
  await el.click()
  await sleep(260)
  return true
}

/** Перемикач етапу у віджеті. */
async function gotoStage(page, stage) {
  await page.evaluate((s) => {
    const url = new URL(window.location.href)
    url.searchParams.set('stage', s)
    window.history.replaceState({}, '', url)
  }, stage)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="target-rail"]')
  await sleep(200)
}

const $ = (page, sel) => page.$(sel)
const text = (page, sel) =>
  page.$eval(sel, (n) => n.textContent.trim()).catch(() => null)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1440, height: 1000 },
})
const page = await browser.newPage()
if (SHOTS) mkdirSync(OUT, { recursive: true })
const shot = async (name) => {
  if (!SHOTS) return
  // Віджет — інструмент, у кадр для бізнесу він не потрапляє.
  await page.evaluate(() => {
    const w = document.querySelector('[data-lab-widget]')
    if (w) w.style.display = 'none'
    document.querySelectorAll('button[aria-label="Розгорнути перемикач осей"]').forEach(
      (b) => (b.style.display = 'none'),
    )
  })
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}

/* ── 1. Посилання в сайдбарі — на кожному етапі ───────────────────────── */
for (const stage of STAGES) {
  await page.goto(`${BASE}?stage=${stage}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="target-rail"]')
  ok(
    `[${stage}] посилання «+ доп. нарахування» є в сайдбарі`,
    !!(await $(page, '[data-testid="sidebar-add-surcharge"]')),
  )
  ok(
    `[${stage}] форма нарахування на етапі закрита`,
    !(await $(page, '[data-testid="surcharge-form"]')),
  )
}

/* ── 1b. Вміст справді прокручується, а не просто «вищий за вікно» ────── */
// Тут я вже помилявся: перевірка `scrollHeight > innerHeight` НІЧОГО не
// доводить. Успадкований `globals.css` ставить `html { overflow: clip }` —
// документ не скролиться ні колесом, ні смугою, а `scrollHeight` усе одно
// росте. Сторінка виглядала «прокручуваною» в прогоні й була обрізаною на
// екрані. Тому перевіряємо дію: зрушуємо контейнер і дивимось, чи став низ
// досяжним.
for (const [vw, vh] of [
  [1366, 768],
  [1280, 720],
]) {
  await page.setViewport({ width: vw, height: vh })
  await page.goto(`${BASE}?scene=disputed&rent=fl&stage=active`, {
    waitUntil: 'networkidle0',
  })
  await page.waitForSelector('[data-testid="card-scroll"]')
  const sc = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="card-scroll"]')
    const before = box.scrollTop
    box.scrollTop = 99999
    const after = box.scrollTop
    const rail = document.querySelector('[data-testid="target-rail"]')
    return {
      moved: after > before,
      overflows: box.scrollHeight > box.clientHeight,
      railBottomReachable: rail.getBoundingClientRect().bottom <= window.innerHeight + 1,
      docOverflow: getComputedStyle(document.documentElement).overflow,
    }
  })
  ok(`[${vw}×${vh}] область вмісту справді прокручується`, sc.moved && sc.overflows)
  ok(`[${vw}×${vh}] низ рейла досяжний прокруткою`, sc.railBottomReachable)
}
await page.setViewport({ width: 1440, height: 1000 })

/* ── 2. Доручення: перехід, робота, повернення ─────────────────────────── */
await page.goto(`${BASE}?stage=active`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
await page.click('[data-testid="sidebar-add-surcharge"]')
await sleep(500)

ok('перехід привів на крок «Оплата»', page.url().includes('stage=payment'))
ok('форма нарахування вже розгорнута', !!(await $(page, '[data-testid="surcharge-form"]')))
// Поле суми і кнопка, якою її зберігають, мають бути видні РАЗОМ. Фокус
// стоїть у полі, тож без цього менеджер друкує суму і не бачить, чим її
// зберегти: на 1366×768 кнопка лишалась на 855px при екрані 768.
await sleep(700)
const formInView = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === 'Додати нарахування',
  )
  const amt = document.querySelector('[data-testid="surcharge-amount"]')
  if (!btn || !amt) return null
  const r = btn.getBoundingClientRect()
  const a = amt.getBoundingClientRect()
  return {
    submit: r.top >= 0 && r.bottom <= window.innerHeight,
    amount: a.top >= 0 && a.bottom <= window.innerHeight,
  }
})
ok('поле суми і кнопка збереження видні разом', !!formInView?.submit && !!formInView?.amount)
ok('смуга доручення зʼявилась', !!(await $(page, '[data-testid="errand-bar"]')))
ok('походження записане в URL', page.url().includes('from=active'))
ok(
  'смуга називає СПРАВУ, а не місце',
  (await text(page, '[data-testid="errand-bar"]'))?.includes('Додаєте нарахування'),
)
ok(
  'нода походження підсвічена на степері',
  !!(await $(page, '[data-testid="stage-node-active"] .ring-fg')) ||
    (await page.$$eval('[data-testid^="stage-node-"]', (ns) =>
      ns.some((n) => n.className.includes("ring-fg")),
    )),
)
await shot('01-errand-open')

// Фокус має бути у формі: приїхали працювати, а не читати.
ok(
  'фокус стоїть у полі суми',
  await page.evaluate(
    () => document.activeElement?.closest('[data-testid="surcharge-form"]') != null,
  ),
)

// Друга форма поверх незавершеної не відкривається.
await page.click('[data-testid="sidebar-add-surcharge"]')
await sleep(300)
ok(
  'повторний клік не плодить другу форму',
  (await page.$$('[data-testid="surcharge-form"]')).length === 1,
)
ok('показане попередження про незавершену дію', !!(await $(page, '[data-testid="unfinished-notice"]')))

/* ── 3. Завели нарахування — воно зʼявилось і справа стала «готово» ────── */
const before = await page.$$eval('[data-testid="surcharge-row"]', (n) => n.length)
await page.type('[data-testid="surcharge-amount"]', '450')
// Стаття витрат обовʼязкова — бриф §6. Без неї сабміт має мовчати, і мовчить.
await clickText(page, 'button', 'Додати нарахування')
await sleep(300)
ok(
  'без статті витрат нарахування не заводиться',
  (await page.$$eval('[data-testid="surcharge-row"]', (n) => n.length)) === before,
)
await page.click('[data-testid="article-picker"]')
await sleep(300)
await page.evaluate(() => {
  const row = document.querySelector('[role="listbox"] [role="option"]')
  if (row) row.click()
})
await sleep(250)
await clickText(page, 'button', 'Додати нарахування')
await sleep(400)
const after = await page.$$eval('[data-testid="surcharge-row"]', (n) => n.length)
ok('нарахування зʼявилось у списку', after === before + 1)
ok(
  'смуга доручення перейшла в «Готово»',
  (await text(page, '[data-testid="errand-bar"]'))?.includes('Готово'),
)
// Найгостріший випадок інваріанта: борг є, і ми стоїмо на кроці, який сам
// про нього говорить. Сайдбар і крок оплати не мають друкувати цифру двічі.
ok(
  'на кроці оплати з боргом сума друкується один раз',
  (await page.$$('[data-money-total]')).length === 1,
)
await shot('02-errand-done')

await page.click('[data-testid="errand-return"]')
await sleep(400)
ok('повернення привело туди, звідки прийшли', page.url().includes('stage=active'))
ok('смуга доручення зникла', !(await $(page, '[data-testid="errand-bar"]')))
ok(
  'нарахування видно з етапу «В роботі» — в хронології сайдбара',
  !!(await $(page, '[data-testid="sidebar-money-flow"]')),
)
await shot('03-back-on-work')

/* ── 5. Гроші в сайдбарі: хронологія і борг ───────────────────────────── */
// Стан тут — наслідок кроку 3: щойно заведене нарахування 450 грн ще не
// закрите, отже борг є. Це і є перевірка ланцюга, а не окремої картинки.
const flow = await text(page, '[data-testid="sidebar-money-flow"]')
const rail = await text(page, '[data-testid="target-rail"]')
// Кожен факт живе в одному місці. Рахунок оренди несе нараховане і
// оплачене; картка руху коштів — тільки те, чого в рахунках немає.
ok('рахунок оренди несе оплачене', rail?.includes('Оплачено'))
ok('доп. нарахування показані при рахунку', rail?.includes('Доп. нарахування'))
ok(
  'картка руху коштів не переказує рахунки',
  !flow?.includes('Нараховано') && !flow?.includes('Прийнято'),
)
ok('утримання із застави показане', flow?.includes('Утримано'))
ok(
  'сума до сплати показана рівно один раз',
  (await page.$$('[data-money-total]')).length === 1,
)
ok(
  'дія «Прийняти доплату» доступна прямо звідси',
  !!(await $(page, '[data-testid="sidebar-settle"]')),
)
await shot('03b-debt-in-rail')

/* ── 6. Кадр 2: таблиця рухів ─────────────────────────────────────────── */
await page.click('[data-testid="open-movements"]')
await sleep(450)
ok('таблиця рухів відкрилась', !!(await $(page, '[data-testid="movements-table"]')))
const rows = await page.$$eval('[data-testid="movement-row"]', (n) => n.length)
ok('у таблиці є рухи', rows > 0)
await shot('04-movements')
await clickText(page, 'button', 'До оренди')
await sleep(350)
ok('повернення з таблиці до картки', !!(await $(page, '[data-testid="target-rail"]')))

/* ── 7. Кадр 3: суми в хронології ─────────────────────────────────────── */
// Кадр окремий, а не другий блок на картці: на етапі «В роботі» панель уже
// показує таблицю позицій, і друга смуга поруч була б тим самим двічі.
ok(
  'на картці немає другої таблиці позицій',
  !(await $(page, '[data-testid="timeline-money"]')),
)
await page.click('[data-testid="open-timeline"]')
await sleep(400)
const tl = await text(page, '[data-testid="timeline-money"]')
ok('кадр хронології з грошима відкривається з шапки', tl != null)
ok('кадр помічено як пропозицію', tl?.includes('пропозиція'))
ok('у хронології є нараховане і оплачене', tl?.includes('Нараховано') && tl?.includes('оплачено'))
await shot('05-timeline')
await clickText(page, 'button', 'До оренди')
await sleep(350)

/* ── 4. Скасування без роботи повертає одразу ─────────────────────────── */
await page.goto(`${BASE}?stage=handover`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
await page.click('[data-testid="sidebar-add-surcharge"]')
await sleep(400)
await clickText(page, 'button', 'Скасувати')
await sleep(400)
ok('скасування форми повернуло на етап походження', page.url().includes('stage=handover'))

/* ── 8. Юрособа — той самий екран, інший вхід ─────────────────────────── */
await page.goto(`${BASE}?stage=payment&rent=ul`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
ok('ЮО: той самий сайдбар з тим самим посиланням', !!(await $(page, '[data-testid="sidebar-add-surcharge"]')))
ok('ЮО: рахунок з ПДВ', (await text(page, '[data-testid="target-rail"]'))?.includes('з ПДВ'))
await shot('06-ul-payment')

/* ── 8b. Пункт 6: готівка за замовчуванням, але змінна ────────────────── */
// `rent=fl` явно: тип контрагента живе в стані лабораторії і переживає
// навігацію. У ЮО флоу інший — рахунок, а не приймання готівки.
await page.goto(`${BASE}?stage=active&rent=fl`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
await page.click('[data-testid="sidebar-add-surcharge"]')
await sleep(500)
await page.type('[data-testid="surcharge-amount"]', '250')
await page.click('[data-testid="article-picker"]')
await sleep(300)
await page.evaluate(() => document.querySelector('[role="listbox"] [role="option"]')?.click())
await sleep(250)
await clickText(page, 'button', 'Додати нарахування')
await sleep(400)
const settleBar = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const accept = btns.find((b) => b.textContent.trim().startsWith('Прийняти '))
  const seg = document.querySelector('[role="radiogroup"][aria-label="Спосіб оплати"]')
  return {
    acceptLabel: accept?.textContent.trim(),
    methods: seg ? [...seg.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
    checked: seg
      ? [...seg.querySelectorAll('button')].find((b) => b.getAttribute('aria-checked') === 'true')?.textContent.trim()
      : null,
  }
})
ok('спосіб оплати видно поруч із дією', settleBar.methods.length >= 3)
ok('готівка підставлена за замовчуванням', settleBar.checked === 'Готівка')
ok('кнопка називає спосіб', settleBar.acceptLabel?.includes('готівкою'))

/* ── 8c. Кадр 2, дельти: розріз по оренді і друк ──────────────────────── */
await page.goto(`${BASE}?stage=active&rent=ul`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
await page.click('[data-testid="open-movements"]')
await sleep(450)
const rentCut = await page.evaluate(() => {
  const seg = document.querySelector('[role="radiogroup"][aria-label="Оренда контрагента"]')
  return seg ? [...seg.querySelectorAll('button')].length : 0
})
ok('у книзі рухів є розріз по орендах контрагента', rentCut > 1)
ok('є вивід на друк', !!(await $(page, '[data-testid="movements-print"]')))

// Аркуш перевіряється НА АРКУШІ. Успадкований `@media print` ховає всю
// сторінку і показує лише `[data-public-invoice]`; поки цього маркера не
// було, кнопка друку давала чистий папір, і на екрані це ніяк не видно.
await page.emulateMediaType('print')
const sheet = await page.evaluate(() => {
  const vis = (el) => el && getComputedStyle(el).visibility === 'visible'
  const root = document.querySelector('[data-public-invoice]')
  return {
    root: vis(root),
    rows: [...document.querySelectorAll('[data-testid="movement-row"]')].filter(vis).length,
    filtersHidden: [...document.querySelectorAll('[data-print-hide]')].every(
      (n) => getComputedStyle(n).display === 'none',
    ),
    header: [...document.querySelectorAll('h1')].some(
      (h) => vis(h) && h.textContent.includes('Взаєморозрахунки'),
    ),
  }
})
ok('аркуш друку не порожній', sheet.root && sheet.rows > 0)
ok('фільтри й кнопки з аркуша прибрані', sheet.filtersHidden)
ok('на аркуші є шапка з контрагентом і періодом', sheet.header)
await page.emulateMediaType(null)
await shot('14-movements-ul')
await clickText(page, 'button', 'До оренди')
await sleep(350)

/* ── 8d. Кадр 4: блок клієнта ─────────────────────────────────────────── */
// Клієнт розведений на два рівні: коротко в рейлі з «Детальніше», розгорнуто
// в табі. Інші оренди й взаєморозрахунки живуть у табі.
ok('у рейлі є дорога вглиб', !!(await $(page, '[data-testid="client-details"]')))
await page.click('[data-testid="rent-tab-client"]')
await sleep(400)
const client = await text(page, '[data-testid="client-block"]')
ok('блок клієнта є в сайдбарі', client != null)
ok('блок помічено як пропозицію', client?.includes('пропозиція'))
ok('видно історію співпраці', /\d+\s+оренд/.test(client ?? ''))
ok('видно борг по всіх орендах', !!(await $(page, '[data-testid="client-debt-total"]')))
ok(
  'видно інші оренди клієнта',
  (await page.$$('[data-testid="client-other-rent"]')).length > 0,
)
ok(
  'борг на сусідній оренді видно з цього екрана',
  client?.includes('12 400') || client?.includes('12 400'),
)

/* ── 8e. Кадр 5: каса за день ─────────────────────────────────────────── */
await page.click('[data-testid="open-cash"]')
await sleep(450)
ok('звіт по касі відкрився', !!(await $(page, '[data-testid="cash-report"]')))
const cashRows = await page.$$eval('[data-testid="cash-row"]', (n) => n.length)
ok('у звіті є операції за день', cashRows > 3)
ok('аномалія названа згори', !!(await $(page, '[data-testid="cash-anomaly"]')))
await page.emulateMediaType('print')
const cashSheet = await page.evaluate(() => {
  const vis = (el) => el && getComputedStyle(el).visibility === 'visible'
  return {
    root: vis(document.querySelector('[data-public-invoice]')),
    rows: [...document.querySelectorAll('[data-testid="cash-row"]')].filter(vis).length,
  }
})
ok('аркуш каси не порожній', cashSheet.root && cashSheet.rows > 0)
await page.emulateMediaType(null)
await shot('15-cash-report')
await page.click('[data-testid="cash-anomaly"]')
await sleep(350)
const onlyUnsettled = await page.$$eval('[data-testid="cash-row"]', (n) => n.length)
ok(
  'фільтр аномалії лишає тільки невзяті ордери',
  onlyUnsettled > 0 && onlyUnsettled < cashRows,
)
await clickText(page, 'button', 'До оренди')
await sleep(350)

// Коли зводити нема чого, картки не існує — лишаються голі посилання.
// Заголовок над двома посиланнями і є той порожній блок, якого бриф просив
// уникати.
await page.goto(`${BASE}?stage=active&rent=ul`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
const bare = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="sidebar-money-flow"]')
  return { text: el?.textContent.trim(), isCard: el?.className.includes('rounded-lg') }
})
ok('без утримань і боргу картки руху коштів немає', !bare.isCard)
ok('дороги в книги операцій лишаються', bare.text?.includes('Усі рухи по оренді'))

/* ── 10. Краї розділу 9 брифу ─────────────────────────────────────────── */
// Кожен край — сцена, отже перевіряється кліком, а не описом.

// 10a. Нуль сум: застава 0 не блокує видачу, смуга не ділить на нуль.
await page.goto(`${BASE}?scene=zero`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
const zero = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('[role="progressbar"]')]
  return {
    note: document.querySelector('[data-testid="zero-invoice-note"]')?.textContent?.trim(),
    nan: bars.some((b) => {
      const v = b.getAttribute('aria-valuenow')
      return v === null || Number.isNaN(Number(v))
    }),
    railText: document.querySelector('[data-testid="target-rail"]')?.textContent ?? '',
  }
})
ok('нульова застава названа, а не просто порожня', !!zero.note)
ok('нуль не блокує видачу — сказано прямо', zero.note?.includes('не блокує'))
ok('жодна смуга не рахує відсоток від нуля', !zero.nan)
// `formatMoney` ставить нерозривний пробіл — звичайний тут не збігається.
ok('нуль надрукований як сума, а не як прочерк', /(^|\D)0\s*грн/.test(zero.railText))
await shot('e1-zero')

// 10b. Від'ємний баланс: мінус названий боргом.
await page.goto(`${BASE}?scene=negative`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="client-block"]')
const neg = await text(page, '[data-testid="client-block"]')
ok('мінус на рахунку названий боргом', neg?.includes('Борг на рахунку'))
ok('сума боргу без знака мінус', !neg?.includes('-3 400') && !neg?.includes('−3 400'))
await shot('e2-negative')

// 10c. Скасоване нарахування: лишається, закреслене, у суми не входить.
await page.goto(`${BASE}?scene=cancelled`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
const cancelled = await page.evaluate(() => {
  // Саме СКАСОВАНИЙ рядок, а не перший у списку: перший тут — прострочення.
  // І перевіряємо обчислений стиль, а не назву класу: закреслення має бути
  // видно на екрані, а не в розмітці.
  const row = [...document.querySelectorAll('[data-testid="surcharge-row"]')].find(
    (r) => r.textContent.includes('скасовано'),
  )
  const struck = row
    ? [...row.querySelectorAll('*')].filter((e) =>
        getComputedStyle(e).textDecorationLine.includes('line-through'),
      ).length
    : 0
  return { exists: !!row, struck: struck > 0, text: row?.textContent ?? '' }
})
ok('скасоване нарахування лишилось у списку', cancelled.exists)
ok('воно закреслене, а не зникло', cancelled.struck)
await page.click('[data-testid="open-movements"]')
await sleep(450)
const ledger = await text(page, '[data-testid="movements-table"]')
ok('у книзі рухів зʼявилось сторно', ledger?.includes('Сторно'))
ok(
  'скасована сума не входить у підсумок',
  !!ledger && !/Оренда: нараховано[^—]*900/.test(ledger),
)
await shot('e3-cancelled')

// 10d. Помилка завантаження: кадр упав, картка жива, є повтор.
await page.goto(`${BASE}?scene=load-error`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
ok('картка оренди жива при зламаному кадрі', !!(await $(page, '[data-testid="target-rail"]')))
await page.click('[data-testid="open-movements"]')
await sleep(450)
const fail = await text(page, '[data-testid="load-failure"]')
ok('стан помилки намальований', fail != null)
ok('названо, що саме не приїхало', fail?.includes('рух коштів'))
ok('сказано, що звіряти з клієнтом не можна', fail?.includes('звіряти'))
ok('є повтор', !!(await $(page, '[data-testid="load-retry"]')))
await shot('e4-load-error')
await page.click('[data-testid="load-retry"]')
await sleep(450)
ok('повтор справді відкриває таблицю', !!(await $(page, '[data-testid="movements-table"]')))

// 10e. Довге найменування послуги ЮО: переноситься, не ламає сітку.
await page.goto(`${BASE}?scene=long-name`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
// Рядки рахунку переїхали в табу «Рахунки»: у 320px рейла повне найменування
// послуги не вміщається, а обрізати його не можна — воно юридично значуще.
await page.click('[data-testid="rent-tab-invoices"]')
await sleep(400)
const longName = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[data-testid="invoice-line-label"]')].find(
    (e) => e.textContent.includes('оцинковані з настилом'),
  )
  return {
    found: !!el,
    clipped: el ? el.scrollWidth > el.clientWidth + 1 : false,
    lines: el ? Math.round(el.getBoundingClientRect().height) : 0,
    pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
ok('повне найменування з 1С присутнє на екрані', longName.found)
ok('воно не обрізане', !longName.clipped)
ok('воно переноситься на кілька рядків', longName.lines > 20)
ok('сторінка не поїхала горизонтально', !longName.pageOverflow)
await shot('e5-long-name')

// 10f. Нарахування під час відкритого діалогу видачі.
await page.goto(`${BASE}?scene=handover-race`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="handover-open"]')
await page.click('[data-testid="handover-open"]')
await sleep(300)
ok('діалог видачі відкрився', !!(await $(page, '[data-testid="handover-confirm"]')))
// Нарахування прилітає збоку, поки діалог відкритий.
await sleep(1400)
const staleBox = await text(page, '[data-testid="handover-stale"]')
ok('діалог помітив нарахування, що прилетіло', staleBox != null)
ok('сказано, з якої суми на яку змінився борг', /з\s.*\sна\s/.test(staleBox ?? ''))
ok(
  'підтвердження видачі знято до перечитування',
  !(await $(page, '[data-testid="handover-confirm"]')),
)
ok('замість нього — перечитати суму', !!(await $(page, '[data-testid="handover-reread"]')))
await shot('e6-handover-race')
// Нуль діб прострочення — не прострочення. Підпис не має брехати числом.
const zeroDays = await page.evaluate(() => document.body.textContent)
ok('немає підпису «Прострочення 0 дн»', !zeroDays.includes('Прострочення 0 дн'))
// Віджет — інструмент: він не має накривати ЖОДЕН текст продукту. Перевірка
// загальна, бо перекриття залежить від кадру: на картці під ним був заголовок
// оренди, на кадрі помилки — заголовок помилки.
const overlaps = () =>
  page.evaluate(() => {
    const w =
      document.querySelector('[data-lab-widget]') ??
      document.querySelector('button[aria-label*="кадрів"]')
    if (!w) return []
    const a = w.getBoundingClientRect()
    return [...document.querySelectorAll('main *')]
      .filter((e) => e.children.length === 0 && e.textContent.trim())
      .filter((e) => {
        const b = e.getBoundingClientRect()
        if (!b.width || !b.height) return false
        return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
      })
      .map((e) => e.textContent.trim().slice(0, 30))
  })
ok('віджет не накриває текст на картці', (await overlaps()).length === 0)
await page.click('[data-testid="handover-reread"]')
await sleep(300)
ok(
  'після перечитування видача знову доступна',
  !!(await $(page, '[data-testid="handover-confirm"]')),
)

/* ── 11. Розміри екрана ───────────────────────────────────────────────── */
// 1366×768 — основний робочий розмір, 1440 і 1920 вторинні. Перевіряється
// не «чи не поламалось», а чи саме основний розмір отримує робочу колонку,
// і чи ніде немає горизонтального скролу сторінки.
const SIZES = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]
const FRAMES = [
  ['картка', '?scene=keys&stage=active&rent=fl', null],
  ['ЮО, довгі назви', '?scene=long-name&rent=ul&stage=payment', null],
  ['видача', '?scene=handover-race', null],
  ['закриття', '?scene=keys&stage=closing&rent=fl', null],
  ['книга рухів', '?scene=keys&stage=active&rent=fl', 'open-movements'],
  ['каса', '?scene=keys&stage=active&rent=fl', 'open-cash'],
]

for (const [w, h] of SIZES) {
  await page.setViewport({ width: w, height: h })
  let overflow = []
  let clipped = []
  for (const [name, q, click] of FRAMES) {
    await page.goto(`${BASE}${q}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="target-rail"]').catch(() => {})
    if (click) {
      await page.click(`[data-testid="${click}"]`).catch(() => {})
      await sleep(500)
    }
    const m = await page.evaluate(() => {
      const de = document.documentElement
      return {
        hs: de.scrollWidth - de.clientWidth,
        // `sr-only` навмисно ширший за свою рамку — це текст для читалки.
        clip: [...document.querySelectorAll('main *')]
          .filter(
            (e) =>
              e.children.length === 0 &&
              e.textContent.trim() &&
              !String(e.className).includes('sr-only') &&
              e.scrollWidth > e.clientWidth + 1,
          )
          .map((e) => e.textContent.trim().slice(0, 24)),
      }
    })
    if (m.hs > 0) overflow.push(`${name} +${m.hs}px`)
    clipped.push(...m.clip)
  }
  ok(`[${w}×${h}] горизонтального скролу немає в жодному кадрі`, overflow.length === 0)
  ok(`[${w}×${h}] жоден рядок не обрізаний`, clipped.length === 0)
}

// Ширший рейл — тільки там, де для нього є поле. На основному розмірі
// зайві 48px належать роботі, а не довідці.
const railAt = async (w, h) => {
  await page.setViewport({ width: w, height: h })
  await page.goto(`${BASE}?scene=keys&stage=active&rent=fl`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="target-rail"]')
  return page.evaluate(() =>
    Math.round(document.querySelector('[data-testid="target-rail"]').getBoundingClientRect().width),
  )
}
ok('на 1366 рейл вужчий — 20rem', (await railAt(1366, 768)) === 320)
ok('на 1599 рейл ще вужчий', (await railAt(1599, 900)) === 320)
ok('з 1600 рейл ширший — 23rem', (await railAt(1600, 900)) === 368)

// Рейл коротший, бо документи і рядки рахунку поїхали у власні таби.
// Перевіряємо саме це: у рейлі їх немає, а в табах вони є.
await page.setViewport({ width: 1366, height: 768 })
await page.goto(`${BASE}?scene=keys&stage=active&rent=fl`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
const railText = await text(page, '[data-testid="target-rail"]')
ok('рейл більше не тримає список документів', !railText?.includes('Договір з ФОП'))
await page.click('[data-testid="rent-tab-documents"]')
await sleep(400)
ok(
  'документи є у своїй табі',
  (await page.$$('[data-testid="document-row"]')).length > 0,
)
await page.setViewport({ width: 1440, height: 1000 })

/* ── 12. Стик табів і степера ─────────────────────────────────────────── */
await page.setViewport({ width: 1366, height: 768 })
await page.goto(`${BASE}?scene=keys&stage=active&rent=fl`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="rent-tabs"]')

const tabIds = ['rent', 'documents', 'invoices', 'registry', 'client']
ok(
  'усі пʼять таб на місці',
  (
    await Promise.all(tabIds.map((t) => $(page, `[data-testid="rent-tab-${t}"]`)))
  ).every(Boolean),
)

// Семантика — навігація, а не патерн табів ARIA. Перевіряємо саме те, що
// раніше було оголошене й не виконане: ролей табів немає, є `nav` і
// `aria-current`, і всі пʼять лишаються в порядку табуляції.
const sem = await page.evaluate(() => {
  const nav = document.querySelector('[data-testid="rent-tabs"] nav')
  const btns = [...document.querySelectorAll('[data-testid^="rent-tab-"]')]
  return {
    nav: !!nav,
    navLabel: nav?.getAttribute('aria-label'),
    tabRoles: document.querySelectorAll('[role="tab"], [role="tablist"]').length,
    current: btns.filter((b) => b.getAttribute('aria-current') === 'page').length,
    focusable: btns.filter((b) => b.tabIndex >= 0).length,
  }
})
ok('розділи оголошені навігацією', sem.nav && !!sem.navLabel)
ok('ролей табів ARIA більше немає', sem.tabRoles === 0)
ok('активний розділ позначений aria-current', sem.current === 1)
ok('усі пʼять лишаються в порядку табуляції', sem.focusable === 5)

// Контраст пігулок лічильника. Міряємо на канві: `oklch` через computed
// style не парситься, і на цьому вже було зроблено хибний висновок.
const pills = await page.evaluate(() => {
  const lum = (c) => {
    const s = c.map((v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
  }
  const R = (a, z) => {
    const A = lum(a)
    const Z = lum(z)
    return (Math.max(A, Z) + 0.05) / (Math.min(A, Z) + 0.05)
  }
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const px = (css) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  }
  const one = (sel) => {
    const e = document.querySelector(sel + ' span:last-child')
    const cs = getComputedStyle(e)
    return {
      fill: R(px(cs.backgroundColor), [255, 255, 255]),
      text: R(px(cs.color), px(cs.backgroundColor)),
    }
  }
  return {
    neutral: one('[data-testid="rent-tab-invoices"]'),
    warn: one('[data-testid="rent-tab-documents"]'),
  }
})
ok('текст нейтральної пігулки тримає AA', pills.neutral.text >= 4.5)
ok('текст янтарної пігулки тримає AA', pills.warn.text >= 4.5)
ok('нейтральна пігулка видима як форма', pills.neutral.fill >= 1.3)

// Рейл не повторює табу, на якій стоїть. Раніше «Рахунки» і «Клієнт»
// показували те саме, що вже лежало в рейлі — 10 і 11 однакових рядків,
// обидві копії на екрані одночасно.
for (const t of ['invoices', 'client']) {
  await page.goto(`${BASE}?scene=keys&stage=active&rent=fl&tab=${t}`, {
    waitUntil: 'networkidle0',
  })
  await page.waitForSelector('[data-testid="target-rail"]')
  const shared = await page.evaluate(() => {
    const lines = (el) =>
      el.innerText
        .split(String.fromCharCode(10))
        .map((x) => x.trim())
        .filter((x) => x.length > 3)
    const rail = document.querySelector('[data-testid="target-rail"]')
    const main = rail.parentElement.firstElementChild
    const r = lines(rail)
    return lines(main).filter((l) => r.includes(l)).length
  })
  ok(`[${t}] рейл не дублює вміст таби`, shared <= 3)
}
await page.goto(`${BASE}?scene=keys&stage=active&rent=fl`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="rent-tabs"]')

// Таби — верхній рівень; степер живе в роботі таби «Оренда», під ними.
const order = await page.evaluate(() => {
  const st = document.querySelector('[data-testid^="stage-node-"]')
  const tabs = document.querySelector('[data-testid="rent-tabs"]')
  return tabs.getBoundingClientRect().top < st.getBoundingClientRect().top
})
ok('таби стоять вище степера', order)

// Головна вимога: таби не мають читатись другим степером. Перевіряємо
// КОНТЕЙНЕР, бо саме він створював пару: біла повноширинна смуга з такою
// самою волосяною межею і тим самим вертикальним відступом, що й степер.
const bands = await page.evaluate(() => {
  const tabs = document.querySelector('[data-testid="rent-tabs"]')
  const cs = getComputedStyle(tabs)
  return { tabsBg: cs.backgroundColor, tabsBorder: cs.borderBottomWidth }
})
ok('смуга табів — біла стрічка, як на резервах', bands.tabsBg === 'rgb(255, 255, 255)')
ok('зі своєю нижньою межею', bands.tabsBorder === '1px')

// Один лівий початок: перше коло степера, підпис першої таби і сітка вмісту.
const origins = await page.evaluate(() => {
  const x = (s, add = 0) =>
    Math.round(document.querySelector(s).getBoundingClientRect().left + add)
  return {
    tab: x('[data-testid="rent-tab-rent"]', 12),
    grid: Math.round(
      document
        .querySelector('[data-testid="target-rail"]')
        .parentElement.getBoundingClientRect().left,
    ),
  }
})
ok('підпис таби і сітка вмісту мають один лівий початок', origins.tab === origins.grid)

// Зміна зрізу не рухає етап: оренда стоїть там само.
await page.click('[data-testid="rent-tab-registry"]')
await sleep(400)
ok('таба реєстру відкрилась', !!(await $(page, '[data-testid="movements-table"]')))
ok('етап не зрушив', page.url().includes('stage=active'))
// Степер належить роботі оренди: на інших зрізах його немає, бо там немає
// чого робити з етапом.
ok(
  'на інших табах степера немає',
  !(await $(page, '[data-testid="stage-node-active"]')),
)
ok('сайдбар лишився на місці', !!(await $(page, '[data-testid="target-rail"]')))
ok(
  'у табі немає другої дороги назад',
  !(await page.evaluate(() =>
    [...document.querySelectorAll('button')].some(
      (b) => b.textContent.trim() === 'До оренди',
    ),
  )),
)
await shot('t1-registry-tab')

// Дорога назад у роботу — таба, а не степер: степера на інших зрізах немає,
// тож двозначності «куди веде клік по етапу» більше не існує.
await page.click('[data-testid="rent-tab-rent"]')
await sleep(400)
ok('таба «Оренда» повертає в роботу', page.url().includes('tab=rent'))
ok('степер зʼявився разом із роботою', !!(await $(page, '[data-testid="stage-node-handover"]')))
await page.click('[data-testid="stage-node-handover"]')
await sleep(400)
ok('клік по етапу переставляє етап', page.url().includes('stage=handover'))

// Доручення повертає ТАБУ, а не лише етап.
await page.click('[data-testid="rent-tab-registry"]')
await sleep(300)
await page.click('[data-testid="sidebar-add-surcharge"]')
await sleep(600)
ok('шорткат привів у роботу кроку оплати', page.url().includes('tab=rent'))
ok('походження запамʼятало табу', page.url().includes('fromTab=registry'))
ok(
  'смуга доручення називає табу походження',
  (await text(page, '[data-testid="errand-bar"]'))?.includes('Реєстр платежів'),
)
await page.click('[data-testid="errand-return"]')
await sleep(400)
ok('повернення привело в табу реєстру', page.url().includes('tab=registry'))
await shot('t2-errand-from-tab')

/* ── 13. ПДВ на рівні статті ──────────────────────────────────────────── */
await page.goto(`${BASE}?scene=keys&stage=active&rent=fl`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="target-rail"]')
await page.click('[data-testid="sidebar-add-surcharge"]')
await sleep(700)
ok('рядок ПДВ є у формі', !!(await $(page, '[data-testid="surcharge-vat"]')))
ok(
  'до вибору статті сказано, що ставка прийде зі статті',
  (await text(page, '[data-testid="surcharge-vat"]'))?.includes('за статтею'),
)
await page.type('[data-testid="surcharge-amount"]', '1200')
// Стаття з групи пошкоджень — санкція, ставка 0.
await page.click('[data-testid="article-picker"]')
await sleep(300)
await page.evaluate(() => {
  const input = document.querySelector('[role="dialog"] input, [role="listbox"]')
  const search = document.querySelector('input[aria-label="Пошук статті витрат"]')
  if (search) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ).set
    setter.call(search, 'Пошкодження')
    search.dispatchEvent(new Event('input', { bubbles: true }))
  }
  void input
})
await sleep(400)
await page.evaluate(() => document.querySelector('[role="listbox"] [role="option"]')?.click())
await sleep(400)
const vatDamage = await text(page, '[data-testid="surcharge-vat"]')
ok('санкція йде без ПДВ за замовчуванням', vatDamage?.includes('Ставка 0%'))
ok('нуль показаний як «у т.ч. ПДВ 0», а не схований', vatDamage?.includes('у т.ч. ПДВ'))

// Менеджер перевизначає галочкою — і бачить, що змінилось.
await page.click('[data-testid="surcharge-vat-toggle"]')
await sleep(300)
const vatOn = await text(page, '[data-testid="surcharge-vat"]')
ok('перевизначення вмикає 20%', vatOn?.includes('Ставка 20%'))
ok('видно виділену суму ПДВ', /200\s*грн/.test(vatOn ?? ''))
ok(
  'перевизначення можна повернути до ставки статті',
  vatOn?.includes('Повернути ставку статті'),
)
await shot('t3-vat')

/* ── 14. Критерій замовника: побачити рухи і роздрукувати ─────────────── */
await page.goto(`${BASE}?scene=keys&stage=active&rent=fl`, { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-testid="rent-tabs"]')
await page.click('[data-testid="rent-tab-registry"]')
await sleep(450)
ok('рухи видно за ОДИН клік від будь-якого місця оренди', !!(await $(page, '[data-testid="movements-table"]')))
ok('друк тут же, другим кліком', !!(await $(page, '[data-testid="movements-print"]')))

/* ── 9. Архів ─────────────────────────────────────────────────────────── */
await page.goto(`${BASE}variants`, { waitUntil: 'networkidle0' })
await sleep(400)
const body = await page.$eval('body', (n) => n.textContent)
ok('/variants називає себе архівом', body.includes('архів'))
// Архів живе за тими самими правилами: своя область прокрутки, бо документ
// під `overflow: clip` не скролиться.
await page.setViewport({ width: 1366, height: 768 })
await page.goto(`${BASE}variants`, { waitUntil: 'networkidle0' })
await sleep(500)
const arch = await page.evaluate(() => {
  const box = document.querySelector('[data-testid="archive-scroll"]')
  if (!box) return null
  const before = box.scrollTop
  box.scrollTop = 99999
  return {
    moved: box.scrollTop > before,
    overflows: box.scrollHeight > box.clientHeight,
    bottomCut:
      document.querySelector('main').getBoundingClientRect().bottom >
      window.innerHeight + 1,
  }
})
ok('архів має власну область прокрутки', arch != null)
ok('низ архіву досяжний', arch != null && (!arch.overflows || arch.moved))
ok('архів не обрізає вміст за краєм вікна', arch != null && !arch.bottomCut)
ok('/variants має дорогу до чинного рішення', body.includes('До чинного рішення'))

console.log(`\n${pass} перевірок пройдено, ${fails.length} впало`)
if (fails.length) {
  console.log(fails.map((f) => '  · ' + f).join('\n'))
}
// Порожній прогін — теж провал: перевірка, яка нічого не перевіряє, гірша за
// її відсутність (на цьому вже обпікались із check-one-number).
if (pass < 30) {
  console.log('ПРОГІН ВИРОДЖЕНИЙ: перевірок менше очікуваного')
}
await browser.close()
process.exit(fails.length || pass < 30 ? 1 : 0)
