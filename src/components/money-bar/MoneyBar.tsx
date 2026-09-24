import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * **Полоса денег** — состояние двух счетов одной сделки: сколько должны и
 * сколько внесли.
 *
 * Модель — **два края у каждого счёта**: край обязательства (`due`) и край
 * внесённого (`paid`). Весь жизненный цикл денег это их взаимное положение:
 * заливка не дошла до края — частичная оплата; край уехал вправо — доп.
 * начисление; край уехал влево, а внесённое торчит — переплата. Последние две
 * ситуации — одна и та же фигура, поэтому приём и возврат выглядят одинаково
 * из геометрии, а не из решения нарисовать две формы похоже.
 *
 * Компонент **домен-свободен**: он не знает ни про аренду, ни про залог, ни про
 * порядок распределения — ему дают два счёта и он их рисует. Кто решает, куда
 * пойдёт внесённая сумма, живёт в фиче (`features/rents`): полоса только
 * сообщает НОВУЮ ОБЩУЮ сумму через `onPaidChange`, а раскладывать её по счетам
 * — не её дело. Ровно поэтому у шва между секциями нет ручки.
 *
 * Суммы форматирует общий `formatMoney` (`lib/money.ts`) — тот же, через
 * который считает остальной CRM. Знак «₴» остаётся аффиксом полей ввода, как в
 * `PaymentEditor`; форматированные величины несут «грн».
 */

export type Account = {
  /** Край обязательства. Растёт от доп. начисления, падает от пересчёта. */
  due: number
  /** Край внесённого. По замороженному счёту не двигается до возврата. */
  paid: number
}

/** Недобор по счёту — внесённое не дошло до края обязательства. */
export const shortOf = (a: Account) => Math.max(a.due - a.paid, 0)
/** Хвост за краем обязательства — деньги клиента, которые у нас лежат. */
export const excessOf = (a: Account) => Math.max(a.paid - a.due, 0)

/**
 * Сумма в правом слоте узла или над полосой. Один кегль на все суммы рельса —
 * первый счёт, второй счёт, «К приёму», — и он же у заголовка узла.
 *
 * Крупный кегль остаётся за суммой ОПЕРАЦИИ («Внесут сейчас», надпись на
 * кнопке); размеры обязательств выстроены в колонку, а три разных кегля в одной
 * колонке — это «до хрена разных шрифтов на одном экране».
 */
export function Amount({ value }: { value: number }) {
  return (
    <span className="text-body font-semibold tabular-nums text-fg">
      {formatMoney(value)}
    </span>
  )
}

/**
 * Тон счёта — ДВА состояния ОДНОГО цвета: внесённое залито в полную силу,
 * оставшееся — тот же цвет, только тише. Ни серой дорожки, ни контура: серое
 * читается как «здесь ничего нет», хотя это и есть обязательство — то, ради
 * чего на полосу смотрят, — а рамка на восьмипиксельной полосе весит столько
 * же, сколько заливка, и превращает счёт в пустой чекбокс. Приглушённый тон
 * говорит ровно то, что нужно: «место этого счёта, деньги ещё не пришли».
 */
const TONE = {
  first: { fill: 'bg-success', rest: 'bg-success/25' },
  second: { fill: 'bg-accent', rest: 'bg-accent/25' },
  excess: { fill: 'bg-warning', rest: 'bg-warning/25' },
} as const

/**
 * **Зазор между секциями счетов, px.** Счета не суммируются, и разрыв говорит
 * это до всякой легенды — две пилюли рядом, а не одна полоса из двух кусков.
 *
 * Живёт числом, а не классом `gap-*`, потому что входит в АРИФМЕТИКУ полосы:
 * метки стоят в координатах дорожки, и без учёта зазора край обязательства и
 * ручка уезжали бы от заливки ровно на его ширину.
 */
const GAP = 4

/**
 * **Полный проход заливки по всей полосе, мс** — и нижняя граница, ниже которой
 * проход не сжимается.
 *
 * Время здесь принадлежит РАССТОЯНИЮ, а не событию: заливка едет с постоянной
 * скоростью, поэтому приём на 250 из 3 300 — это короткий рывок, а закрытие
 * обоих счетов разом — один длинный проход. Раньше у каждого сегмента была своя
 * пятисотка, и полная оплата запускала две ОДНОВРЕМЕННЫЕ анимации в разных
 * концах полосы: обе секции наливались параллельно, полполосы прибывало
 * ниоткуда, и на глаз это читалось и дольше, и непонятнее, чем есть.
 */
const SWEEP_MS = 480
const SWEEP_MIN_MS = 160

/** Тайминг одного сегмента внутри общего прохода. */
type Timing = { duration: number; delay: number }

const STILL: Timing = { duration: 0, delay: 0 }

/**
 * Сегмент внутри секции. Рендерится всегда, даже нулевым — иначе
 * размонтирование убивает анимацию ширины, а движение шкалы и есть предмет
 * состояний «доплата» и «досрочная сдача». Скругление не своё: его даёт
 * пилюля секции, поэтому шов между заливкой и остатком — прямой рез.
 *
 * Кривая — `linear`, и это не лень: два соседних сегмента должны сойтись в ОДНО
 * движение. Любое ускорение внутри куска даёт на стыке рывок, и вместо одной
 * заливки, переходящей из счёта в счёт, снова видно две анимации подряд.
 */
function Seg({
  pct,
  tone,
  timing,
}: {
  pct: number
  tone: string
  timing: Timing
}) {
  return (
    <span
      className={cn('h-full transition-[width] ease-linear', tone)}
      style={{
        width: `${pct}%`,
        transitionDuration: `${timing.duration}ms`,
        transitionDelay: `${timing.delay}ms`,
      }}
    />
  )
}

/**
 * **Секция счёта** — отдельная пилюля во всю ширину своего масштаба.
 *
 * Фон секции И ЕСТЬ незакрытая часть обязательства, поэтому недобору не нужен
 * свой элемент: он просвет. Внутри рисуется только то, что закрашено плотно —
 * заливка и хвост переплаты. `overflow-hidden` заодно снимает вечную проблему
 * нулевой секции: без ширины от неё не остаётся ни пикселя.
 */
function Section({
  tone,
  width,
  fillPct,
  tailPct,
  fillTiming,
  tailTiming,
  spanTiming,
}: {
  tone: (typeof TONE)[keyof typeof TONE]
  /** CSS-ширина: доля масштаба от дорожки БЕЗ зазора (см. `GAP`). */
  width: string
  fillPct: number
  tailPct: number
  fillTiming: Timing
  tailTiming: Timing
  /**
   * Задан — пилюля растёт вместе с проходом заливки. Нужно при переплате: там
   * масштаб счёта и его хвост едут ОТ ОДНИХ ДЕНЕГ, и разъехавшись во времени
   * пилюля отрезала бы `overflow-hidden` собственный хвост на полпути. Без
   * прохода (пересчёт обязательства — деньги не двигались) остаётся своя
   * кривая: это отдельное событие, и оно вправе выглядеть отдельно.
   */
  spanTiming?: Timing
}) {
  return (
    <span
      className={cn(
        'flex h-full overflow-hidden rounded-full transition-[width]',
        spanTiming ? 'ease-linear' : 'duration-500 ease-out',
        tone.rest,
      )}
      style={{
        width,
        transitionDuration: spanTiming ? `${spanTiming.duration}ms` : undefined,
        transitionDelay: spanTiming ? `${spanTiming.delay}ms` : undefined,
      }}
    >
      <Seg pct={fillPct} tone={tone.fill} timing={fillTiming} />
      <Seg pct={tailPct} tone={TONE.excess.fill} timing={tailTiming} />
    </span>
  )
}

/**
 * **Проход заливки, переживающий чужие перерисовки.**
 *
 * Тайминги считаются РОВНО ОДИН РАЗ — в тот рендер, когда изменились сами
 * величины, — и дальше отдаются теми же, пока величины стоят на месте.
 *
 * Здесь была пара «прошлое в ref + пересчёт каждый рендер», и она ломала
 * анимацию о любой посторонний рендер. Приём оплаты (замерено): в 104 мс полоса
 * трогается с `transition-duration: 160ms`, в 114 мс приезжает список принятых
 * платежей — компонент перерисовывается, прошлое в ref уже равно настоящему,
 * `sweep` возвращает `STILL`, и `transition-duration` на лету становится `0ms`.
 * Браузер честно доигрывает переход за ноль миллисекунд: заливка не едет, а
 * прыгает. Причём чем больше на экране живых запросов, тем вероятнее рывок —
 * анимация зависела от того, перерисуют ли соседа за её 480 мс.
 *
 * Ключ — сами величины: пока они те же, едет тот же проход, сколько бы раз
 * компонент ни позвали. Запись в ref по ходу рендера идемпотентна (второй вызов
 * в StrictMode видит уже совпавший ключ и ничего не трогает), поэтому двойной
 * рендер её не ломает — в отличие от прежней записи «текущее поверх прошлого».
 */
function useSweep(values: number[], scale: number): Timing[] {
  const key = values.join('|')
  const ride = useRef({ key, from: values, timings: values.map(() => STILL) })
  if (ride.current.key !== key) {
    ride.current = {
      key,
      from: values,
      timings: sweep(ride.current.from, values, scale),
    }
  }
  return ride.current.timings
}

/**
 * Раскладка общего прохода по сегментам: сколько каждый едет и когда трогается.
 *
 * Длительность прохода — от ПУТИ: доля масштаба, которую полоса проезжает, от
 * `SWEEP_MS`, но не короче `SWEEP_MIN_MS` (иначе мелкий приём становится
 * мгновенной подменой картинки, а её глаз не читает как движение). Внутри
 * прохода время делится по расстоянию, поэтому куски стыкуются встык: следующий
 * трогается ровно тогда, когда предыдущий встал.
 */
function sweep(from: number[], to: number[], scale: number): Timing[] {
  const deltas = to.map((v, i) => v - (from[i] ?? v))
  const path = deltas.reduce((sum, d) => sum + Math.abs(d), 0)
  if (path <= 0 || scale <= 0) return to.map(() => STILL)

  const total = Math.max(
    SWEEP_MIN_MS,
    Math.min(SWEEP_MS, SWEEP_MS * (path / scale)),
  )
  // Прибыль — слева направо, убыль — справа налево. Порядок обхода и есть
  // «фронт едет в одну сторону».
  const forward = deltas.reduce((sum, d) => sum + d, 0) >= 0
  const order = to.map((_, i) => (forward ? i : to.length - 1 - i))

  const timings: Timing[] = to.map(() => STILL)
  let passed = 0
  for (const i of order) {
    const step = Math.abs(deltas[i] ?? 0)
    timings[i] = {
      duration: (total * step) / path,
      delay: (total * passed) / path,
    }
    passed += step
  }
  return timings
}

/**
 * Вертикальная метка поверх полосы: край обязательства, пунктир «было», ручка
 * перетаскивания. Позиционируется абсолютно по всей дорожке — так она не
 * воюет с `overflow-hidden` секций и не воровает у них ширину.
 */
function Mark({
  left,
  tone,
  thin,
  timing,
  className,
}: {
  /** Готовое CSS-значение: зазор между секциями уже учтён вызывающим. */
  left: string
  tone: string
  /** Пунктир «было» тоньше — он справка, а не край. */
  thin?: boolean
  /** Задан — метка едет вместе с заливкой, а не по своей кривой. */
  timing?: Timing
  className?: string
}) {
  return (
    <span
      className={cn(
        'absolute inset-y-0 -translate-x-1/2 transition-[left]',
        timing ? 'ease-linear' : 'duration-500 ease-out',
        thin ? 'w-px' : 'w-0.5',
        tone,
        className,
      )}
      style={{
        left,
        transitionDuration: timing ? `${timing.duration}ms` : undefined,
        transitionDelay: timing ? `${timing.delay}ms` : undefined,
      }}
    />
  )
}

/**
 * **Дорожка.** Ширина секции = масштаб счёта (`max(due, paid)` — «всё, что в
 * игре по этому счёту»), внутри секции заливка = внесённое.
 *
 * Секции разделены **зазором**, а не сливаются в одну полосу: два счёта не
 * суммируются, и на картинке это должно быть видно без сноски. Общая сумма
 * живёт подписью над полосой — это удобство показа, а не объединение счетов.
 *
 * В неинтерактивном виде дорожка `aria-hidden`: каждое её число продублировано
 * текстом в легенде под ней, а `role="progressbar"` здесь соврал бы — прогресса
 * два, и один из них умеет уходить в минус. С `onChange` она становится
 * настоящим `slider` и озвучивает `aria-valuetext` тем же текстом, который
 * виден в легенде.
 */
function BarTrack({
  first,
  second,
  ghostFirstDue,
  compact,
  onChange,
  step,
  valueText,
}: {
  first: Account
  second: Account
  ghostFirstDue: number | null
  compact?: boolean
  /** Задан — дорожка ловит мышь и клавиатуру. Отдаёт НОВУЮ ОБЩУЮ сумму. */
  onChange?: (totalPaid: number) => void
  step: number
  valueText: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const firstSpan = Math.max(first.due, first.paid)
  const secondSpan = Math.max(second.due, second.paid)
  const scale = firstSpan + secondSpan

  /**
   * Зазор появляется только когда разделять есть что. Со счётом без залога он
   * стал бы четырьмя пикселями пустоты у правого края — полоса, не дотянутая
   * до конца дорожки без всякой причины.
   */
  const gap = firstSpan > 0 && secondSpan > 0 ? GAP : 0
  /** Доля величины в масштабе полосы, 0…1. */
  const frac = (v: number) => (scale > 0 ? v / scale : 0)
  /**
   * Геометрия дорожки в CSS. Проценты берутся от ширины БЕЗ зазора, поэтому
   * секции и метки считаются в одной системе координат: `calc()` умеет
   * умножать число на длину, и доля счёта раскладывается точно, без опоры на
   * то, как флекс поделит переполнение.
   */
  const widthOf = (v: number) => `calc(${frac(v)} * (100% - ${gap}px))`
  /** Левый край метки. За швом всё сдвинуто на зазор — он тоже расстояние. */
  const leftOf = (v: number) =>
    `calc(${frac(v)} * (100% - ${gap}px) + ${v > firstSpan ? gap : 0}px)`
  /** Доля внутри своей секции — сегменты живут в её процентах, не в общих. */
  const inSection = (v: number, span: number) => (span > 0 ? (v / span) * 100 : 0)

  const firstFill = Math.min(first.due, first.paid)
  const secondFill = Math.min(second.due, second.paid)
  const firstTail = excessOf(first)
  const secondTail = excessOf(second)

  /**
   * **Один проход вместо четырёх анимаций.** Плотные куски полосы перечислены в
   * порядке оси — заливка первого счёта, его хвост, заливка второго, его хвост,
   * — и приезжают ПО ОЧЕРЕДИ, каждый со своей долей общего времени. Прибыль
   * наливается слева направо, убыль откатывается справа налево: в обе стороны
   * едет один фронт, а не «где-то посередине само собой прибавилось».
   */
  const filled = [firstFill, firstTail, secondFill, secondTail]
  const timings = useSweep(filled, scale)
  /** Длина всего прохода. Ноль — деньги не двигались, анимации нет. */
  const sweepTotal = timings.reduce((sum, t) => sum + t.duration, 0)
  const rideSweep: Timing | undefined =
    sweepTotal > 0 ? { duration: sweepTotal, delay: 0 } : undefined

  const totalDue = first.due + second.due
  const totalPaid = first.paid + second.paid
  /**
   * Правый край внесённого — там, где стоит ручка. Пока первый счёт не закрыт,
   * заливка кончается на нём; дальше она продолжается за швом.
   */
  const paidEdge =
    shortOf(first) > 0 ? firstFill : firstFill + firstTail + secondFill

  /* Пунктир прячется, когда совпадает со швом: при пересчёте прежний край
     первого счёта и есть правая граница секции, и две метки в одной точке
     читались бы как одна жирная. */
  const ghost =
    ghostFirstDue !== null && Math.abs(ghostFirstDue - firstSpan) > 1
      ? ghostFirstDue
      : null

  /**
   * **Потолок перетаскивания — обязательство, а не масштаб полосы.** Тянуть
   * можно от нуля до «оба счёта закрыты»; переплата остаётся достижимой из
   * данных, но не движением руки. Опечатка в сумме — самый дорогой промах
   * приёма, и он не должен случаться от того, что рука проехала дальше.
   */
  const clamp = (v: number) => Math.min(Math.max(Math.round(v), 0), totalDue)

  const valueAt = (clientX: number) => {
    const el = trackRef.current
    if (!el || scale <= 0) return totalPaid
    const rect = el.getBoundingClientRect()
    // Зазор — расстояние, а не значения: под курсором в нём стоит шов, и
    // тянущийся через него палец не должен прибавлять денег из воздуха.
    const usable = Math.max(1, rect.width - gap)
    const seam = frac(firstSpan) * usable
    const x = clientX - rect.left
    return clamp(((x <= seam ? x : x - gap) / usable) * scale)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onChange) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(valueAt(e.clientX))
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onChange || !dragging.current) return
    onChange(valueAt(e.clientX))
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onChange) return
    let next: number | undefined
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = clamp(totalPaid + step)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = clamp(totalPaid - step)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = totalDue
        break
      default:
        return
    }
    // Гасим прокрутку страницы даже когда двигаться некуда: дорожка забрала
    // клавишу себе, и «стрелка ничего не сделала, зато уехал скролл» — худший
    // из возможных откликов.
    e.preventDefault()
    onChange(next)
  }

  const interactive = Boolean(onChange)

  return (
    <div
      ref={trackRef}
      aria-hidden={interactive ? undefined : true}
      role={interactive ? 'slider' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Внесена сума' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      /* Переплата, пришедшая из данных, расширяет диапазон: `valuenow` вне
         `valuemin…valuemax` — сломанный слайдер, а врать про внесённое нельзя
         тем более. Вернуться туда перетаскиванием всё равно не выйдет. */
      aria-valuemax={interactive ? Math.max(totalDue, totalPaid) : undefined}
      aria-valuenow={interactive ? totalPaid : undefined}
      aria-valuetext={interactive ? valueText : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(
        'relative flex w-full rounded-full',
        compact ? 'h-1.5' : 'h-2.5',
        interactive && [
          'h-3 cursor-grab touch-none select-none active:cursor-grabbing',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2',
        ],
      )}
      style={{ columnGap: `${gap}px` }}
    >
      <Section
        tone={TONE.first}
        width={widthOf(firstSpan)}
        fillPct={inSection(firstFill, firstSpan)}
        tailPct={inSection(firstTail, firstSpan)}
        fillTiming={timings[0] ?? STILL}
        tailTiming={timings[1] ?? STILL}
        spanTiming={rideSweep}
      />
      <Section
        tone={TONE.second}
        width={widthOf(secondSpan)}
        fillPct={inSection(secondFill, secondSpan)}
        tailPct={inSection(secondTail, secondSpan)}
        fillTiming={timings[2] ?? STILL}
        tailTiming={timings[3] ?? STILL}
        spanTiming={rideSweep}
      />

      {/* Шва-риски нет: счета разведены ЗАЗОРОМ и цветом, и вертикальная черта
          поверх скруглённых пилюль только резала бы картинку. */}
      {/* Край обязательства виден только когда внесённое за него вышло — в
          остальных случаях он совпадает с концом секции. */}
      {firstTail > 0 && <Mark left={leftOf(first.due)} tone="bg-fg" />}
      {secondTail > 0 && second.due > 0 && (
        <Mark left={leftOf(firstSpan + second.due)} tone="bg-fg" />
      )}
      {ghost !== null && <Mark left={leftOf(ghost)} tone="bg-fg-2" thin />}

      {/* Ручка — на краю внесённого, единственной подвижной величине. Едет
          ВЕСЬ проход целиком и без задержки: она и есть фронт заливки, и
          отстать от него хоть на кадр значит оторваться от своего края. */}
      {interactive && (
        <Mark
          left={leftOf(paidEdge)}
          tone="bg-fg"
          timing={rideSweep}
          className="w-1 rounded-full"
        />
      )}
    </div>
  )
}

/**
 * Метка легенды повторяет ту же фигуру, что на полосе: закрытый счёт залит
 * плотно, незакрытый — приглушён. Иначе легенда объясняет цвет, но не
 * состояние, и глазу приходится сверять её с полосой самому. Обводки здесь нет
 * по той же причине, что и на полосе: квадратик в рамке читается чекбоксом, и
 * легенда превращается в список галочек, которые никто не ставил.
 */
function Marker({ tone, filled }: { tone: (typeof TONE)[keyof typeof TONE]; filled: boolean }) {
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-xs',
        filled ? tone.fill : tone.rest,
      )}
      aria-hidden
    />
  )
}

/**
 * Состояние счёта словами. Число в легенде — всегда **обязательство**, слово
 * после него — что с ним не так. Пара «внесено/должны» в одной строке
 * («2 700 из 1 300») при переплате читается сломанной, поэтому вторая величина
 * названа именем: «переплата 1 400 грн».
 *
 * `preview` — полоса показывает не состояние, а то, что СТАНЕТ после нажатия.
 * Тогда «закрыт» и «заморожен до возврата» врут: деньги ещё не приняты.
 * Меняется только этот регистр времени, арифметика та же.
 */
function accountState(a: Account, frozen: boolean, preview?: boolean): string {
  if (a.due === 0) return a.paid > 0 ? 'до повернення' : 'закритий'
  if (a.paid === 0) return 'не оплачений'
  if (a.paid < a.due) return `не вистачає ${formatMoney(a.due - a.paid)}`
  if (a.paid > a.due) return `переплата ${formatMoney(a.paid - a.due)}`
  if (preview) return 'закриється'
  return frozen ? 'заморожена до повернення' : 'закритий'
}

/**
 * Те состояния, которые полоса уже показала ГЕОМЕТРИЕЙ. Пустая секция — это и
 * есть «не оплачен», полная — «закрыт»; подпись рядом повторяла картинку
 * словами и делала легенду шумной.
 *
 * Состояния с ЧИСЛОМ («не хватает 1 300», «переплата 400») остаются: величину
 * недобора по ширине заливки не прочитать, её может сказать только текст.
 *
 * Убирается только ВИДИМАЯ подпись. В `aria-valuetext` состояние остаётся
 * полным: незрячий геометрию не видит, и «объясняется через UI» для него не
 * работает.
 */
const SHOWN_BY_THE_BAR = new Set(['не оплачений', 'закритий'])
const visibleState = (state: string) =>
  SHOWN_BY_THE_BAR.has(state) ? '' : state

/**
 * Пункт легенды — метка, имя счёта и то, что с ним не так.
 *
 * **Обязательства в легенде НЕТ.** «Аренда 600 грн» рядом с секцией счетов, где
 * ровно эти 600 грн уже написаны крупно и по-своему, — одно число дважды на
 * одном экране, и второе прочтение ничего не добавляет. Легенда объясняет ЦВЕТ
 * и состояние; сколько должны, говорит счёт.
 *
 * Числа, которых больше нигде нет, остаются: «не хватает 1 300» и «переплата
 * 400» выводятся из двух величин сразу и не написаны ни в одной секции.
 */
function LegendItem({
  tone,
  filled,
  name,
  state,
  compact,
}: {
  tone: (typeof TONE)[keyof typeof TONE]
  filled: boolean
  name: string
  state: string
  compact?: boolean
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-label text-muted-fg">
      <Marker tone={tone} filled={filled} />
      {name}
      {!compact && visibleState(state) && (
        <span className="truncate">— {visibleState(state)}</span>
      )}
    </span>
  )
}

/**
 * **Легенда полосы — отдельным экспортом.**
 *
 * Она объясняет цвета дорожки, но не обязана стоять под ней: на экране оплаты
 * ей место в шапке секции справа, на одной строке с заголовком, — там она
 * подписывает полосу, не отнимая у неё строки и не отодвигая таблицу вниз.
 * Поэтому легенда вынута из `MoneyBar` (`hideLegend`) и может быть поставлена
 * туда, где нужна вызывающему.
 */
export function MoneyBarLegend({
  first,
  second,
  preview,
  compact,
}: {
  first: NamedAccount
  second: NamedAccount
  /** Полоса показывает «станет», а не «есть» — см. `accountState`. */
  preview?: boolean
  /** Узкий рейл: состояния словами не показываются. */
  compact?: boolean
}) {
  const excess = excessOf(first) + excessOf(second)
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <LegendItem
        tone={TONE.first}
        filled={shortOf(first) === 0}
        name={first.name}
        state={accountState(first, false, preview)}
        compact={compact}
      />
      {(second.due > 0 || second.paid > 0) && (
        <LegendItem
          tone={TONE.second}
          filled={shortOf(second) === 0}
          name={second.name}
          state={accountState(second, true, preview)}
          compact={compact}
        />
      )}
      {excess > 0 && (
        <span className="flex items-center gap-1.5 text-label text-warning-fg">
          <Marker tone={TONE.excess} filled />
          К возврату <span className="tabular-nums">{formatMoney(excess)}</span>
        </span>
      )}
    </div>
  )
}

/** Счёт со своим именем — так он подписан в легенде и в `aria-valuetext`. */
export type NamedAccount = Account & { name: string }

/**
 * **Полоса денег** — дорожка, под ней легенда и главное число. Один и тот же
 * блок на всех этапах, в обоих размерах и в шаге приёма: это и есть
 * переиспользуемый денежный компонент — переиспользуется не форма приёма, а
 * состояние денег.
 *
 * Порядок именно такой: сначала картинка, потом числа. Раньше над дорожкой
 * стояла строка «К оплате / Оплачено» с суммой, и блок начинался с подписи —
 * четыре ряда на один смысл. Подпись убрана, число уехало под дорожку в правый
 * край строки легенды: что оно означает, говорит сама заливка — пустая
 * дорожка это «столько внести», полная — «столько внесено».
 */
export function MoneyBar({
  first,
  second,
  ghostFirstDue = null,
  compact,
  preview,
  hideTotal,
  hideLegend,
  onPaidChange,
  step = 100,
}: {
  /** Счёт, который гасится первым — его секция стоит слева от шва. */
  first: NamedAccount
  /** Второй счёт. Заморожен: его состояние озвучивается иначе. */
  second: NamedAccount
  /** Где стоял край первого счёта до пересчёта — пунктир «было». */
  ghostFirstDue?: number | null
  compact?: boolean
  /** Полоса показывает «станет», а не «есть» — см. `accountState`. */
  preview?: boolean
  /**
   * Без главного числа в строке легенды.
   *
   * Нужно там, где это число уже несёт заголовок узла: второе такое же
   * двадцатью пикселями ниже было бы дублем.
   */
  hideTotal?: boolean
  /**
   * Без легенды под дорожкой — её ставит вызывающий, туда, где ей место
   * (`MoneyBarLegend`). На экране оплаты это правый край шапки секции.
   */
  hideLegend?: boolean
  /**
   * Полоса становится контролом: перетаскивание и стрелки меняют **общую
   * внесённую сумму**, и она приходит сюда одним числом.
   *
   * Разложить её по счетам — работа вызывающей стороны: порядок распределения
   * принадлежит домену, а не полосе. Наружу торчат данные и колбэк, а не форма.
   */
  onPaidChange?: (totalPaid: number) => void
  /** Шаг стрелок клавиатуры. Мышь тянет непрерывно. */
  step?: number
}) {
  const short = shortOf(first) + shortOf(second)

  const firstState = accountState(first, false, preview)
  const secondState = accountState(second, true, preview)
  /** Ровно то, что видит зрячий в легенде — и слышит незрячий на слайдере. */
  const valueText = [
    `Внесено ${formatMoney(first.paid + second.paid)}`,
    `${first.name} ${formatMoney(first.due)} — ${firstState}`,
    second.due > 0 || second.paid > 0
      ? `${second.name} ${formatMoney(second.due)} — ${secondState}`
      : null,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    // Блок, который НАЧИНАЕТСЯ С ТЕКСТА, берёт себе верхний отступ: подпись
    // «Принято … из …» иначе садится вплотную к заголовку секции над ней, и
    // две строки мелкого кегля слипаются в одну серую массу. Без подписи
    // (`hideTotal`) отступ не нужен — сверху сразу полоса, ей воздух не нужен,
    // а лишний он бы только оторвал её от заголовка узла.
    <div className={cn('flex flex-col gap-2', !hideTotal && 'pt-1')}>
      {/* ЧИСЛО НАД ПОЛОСОЙ — одно: сколько ещё принимать.

          Здесь стояла фраза «Принято 0 грн из 3 600 грн» — два числа мелким
          кеглем, из которых главное приходилось вычитать в уме, а «принято 0»
          вдобавок сообщало ровно ничего. Осталось то, ради чего на блок
          смотрят, и набрано оно как сумма счёта в карточках выше
          (`text-headline`, `font-semibold`): одна величина одного порядка —
          один кегль, иначе экран говорит о деньгах тремя разными голосами.
          Что это за число, называет заголовок секции.

          Ноль приглушён: «принимать больше нечего» — это отсутствие работы, и
          кричать о нём тем же весом, что о непринятых тысячах, незачем. */}
      {!hideTotal && (
        <span
          className={cn(
            'text-headline font-semibold leading-none tabular-nums',
            short > 0 ? 'text-fg' : 'text-muted-fg',
          )}
        >
          {formatMoney(short)}
        </span>
      )}

      <BarTrack
        first={first}
        second={second}
        ghostFirstDue={ghostFirstDue}
        compact={compact}
        onChange={onPaidChange}
        step={step}
        valueText={valueText}
      />

      {!hideLegend && (
        <MoneyBarLegend
          first={first}
          second={second}
          preview={preview}
          compact={compact}
        />
      )}
    </div>
  )
}
