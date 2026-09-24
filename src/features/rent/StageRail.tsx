import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ReactNode,
} from 'react'
import {
  Check,
  Clock3,
  CircleDashed,
  CircleAlert,
  Pencil,
  type LucideIcon,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Тон узла рельса:
 *
 *  - `done` — этап позади. Сюда же попадают «Счета к оплате»: выполнять там
 *    нечего, но к моменту оплаты счета уже начислены, поэтому этап читается
 *    пройденным, а не нейтральной серой заглушкой;
 *  - `current` — здесь работают прямо сейчас (ink, как активная кнопка);
 *  - `idle` — до этапа ещё не дошли; пунктирная обводка, как у пустых зон.
 */
export type StageTone =
  | 'current'
  | 'done'
  | 'idle'
  | 'ready'
  | 'editing'
  | 'waiting'
  | 'partial'
  | 'attention'

const TONE: Record<StageTone, string> = {
  ready: 'border-border-strong bg-card text-fg',
  editing: 'border-fg bg-fg text-primary-fg',
  waiting: 'border-border-strong bg-muted text-muted-fg',
  partial: 'border-notice-fg bg-notice-soft text-notice-fg',
  attention: 'border-danger-fg bg-danger-soft text-danger-fg',
  current: 'border-fg bg-fg text-primary-fg',
  done: 'border-success bg-success text-white',
  idle: 'border-dashed border-border-strong bg-card text-subtle',
}

/** Цвет отрезка: пройденный путь зелёный, ещё не пройденный — серый. */
const lineOf = (tone: StageTone | null) =>
  tone === 'done' ? 'bg-success' : 'bg-border'

/**
 * Место шага в ряду — знание контейнера, а не шага. Сам шаг вывести его не
 * может: и «последний ли я», и «каким тоном пришла линия сверху» зависит от
 * соседей, а соседей знает только рельс.
 */
interface StepPlace {
  first: boolean
  last: boolean
  /** Тон предыдущего шага — им красится ВХОДЯЩИЙ отрезок этого. */
  prevTone: StageTone | null
}

const StepPlaceContext = createContext<StepPlace>({
  first: true,
  last: true,
  prevTone: null,
})

/**
 * Рельс ЭТАПОВ — контейнер, который владеет линией.
 *
 * Рельс ведёт по экрану — счета → способы → реестр → выдача — и живёт ВНУТРИ
 * контентного слота, отжимая секции вправо: он часть колонки, а не декорация
 * на полях. Отличие от `TimelineNode` в том, что заголовок остаётся внутри
 * карточки секции, а снаружи только узел и линия; внутри секции способов при
 * этом работает свой, мелкий таймлайн шагов — два таймлайна разного масштаба
 * не должны выглядеть одинаково.
 *
 * Шаги передаются слотами (`<StageRail.Step>`), и контейнер сам определяет их
 * место в ряду. Раньше это был ручной проп `last` на вызове, а значит — знание
 * о соседях, размазанное по месту использования: стоило условному шагу реестра
 * исчезнуть, и «последним» оставался тот, кто им уже не был. Считать соседей —
 * работа контейнера.
 *
 * Активный узел крупнее остальных примерно в 1,3 раза (24 → 32 px): взгляд
 * должен находить «где я сейчас» раньше, чем прочитает иконку. Линия ПОСЛЕ
 * пройденного этапа зелёная — путь, который деньги уже прошли, отличается от
 * серого «ещё впереди».
 */
export function StageRail({
  children,
  testId,
}: {
  children: ReactNode
  /** `data-testid` контейнера — рельс и есть корень своего экрана. */
  testId?: string
}) {
  // `Children.toArray` выбрасывает `false` от условных шагов (реестр платежей
  // появляется только с платежами), поэтому соседи считаются по реально
  // отрисованным узлам, а не по позиции в JSX.
  const steps = Children.toArray(children).filter(
    isValidElement<StageRailStepProps>,
  )
  const lastIndex = steps.length - 1

  return (
    <div className="flex min-w-0 flex-col" data-testid={testId}>
      {steps.map((step, index) => (
        // Ключ — свой у шага, не индекс: иначе появление реестра сдвигает
        // позиции и пере-монтирует всё, что ниже (гейт выдачи теряет состояние).
        <StepPlaceContext.Provider
          key={step.key ?? index}
          value={{
            first: index === 0,
            last: index === lastIndex,
            prevTone:
              index === 0 ? null : (steps[index - 1]?.props.tone ?? null),
          }}
        >
          {step}
        </StepPlaceContext.Provider>
      ))}
    </div>
  )
}

interface StageRailStepProps {
  tone: StageTone
  heading?: boolean
  headingStatus?: ReactNode
  aside?: ReactNode
  status?: ReactNode
  icon: LucideIcon
  testId?: string
  /**
   * Подпись узла в тултипе. Дублирует заголовок секции справа намеренно: узел
   * — единственное, что остаётся видимым, когда взгляд идёт по рельсу, а не по
   * карточкам. Для скринридера это не потеря — заголовок секции рядом и он
   * настоящий, поэтому узел остаётся декоративным и не забирает таб-стоп.
   */
  label: ReactNode
  children: ReactNode
}

/**
 * Узел рельса + секция справа от него.
 *
 * Линия собрана из двух flex-отрезков вместо одного абсолютного с подогнанным
 * вручную отступом сверху (`top-9`/`top-10` под два размера узла — и всё равно
 * мимо на 2–4 px):
 *
 *  - **входящий** — он же отступ узла от верха строки. У первого шага просто
 *    пустой распорка-отрезок, у остальных крашен тоном ПРЕДЫДУЩЕГО этапа;
 *  - **исходящий** — `flex-1`, добирает остаток высоты строки под узлом.
 *
 * Отсюда непрерывность: нижний отступ строки живёт теперь на КОНТЕНТНОЙ ячейке,
 * поэтому колонка узлов тянется на всю высоту строки, исходящий отрезок доходит
 * ровно до её низа, а входящий отрезок следующей строки продолжает его от
 * самого верха. Шва нет ни на стыке строк, ни под узлом любого размера.
 */
function StageRailStep({
  tone,
  icon: DefaultIcon,
  heading,
  headingStatus,
  aside,
  status,
  label,
  children,
  testId,
}: StageRailStepProps) {
  const { last } = useContext(StepPlaceContext)
  const current = tone === 'current' || tone === 'editing'
  const Icon =
    tone === 'done'
      ? Check
      : tone === 'waiting'
        ? Clock3
        : tone === 'partial'
          ? CircleDashed
          : tone === 'attention'
            ? CircleAlert
            : tone === 'editing'
              ? Pencil
              : DefaultIcon

  return (
    // Колонка узлов ровно по ширине активного узла (32 px), а зазор до секции
    // узкий: рельс должен читаться прижатым к секциям, которые он отжимает, а
    // не отдельной полосой на полях — иначе секции выглядят вдавленными слева
    // при флаше справа.
    //
    // Ширина — из `--stage-spine-width` (BP-1074), а не из литерала: та же
    // величина задаёт ось, на которую садит свои кружки горизонтальный спайн
    // этапов сверху. Разъехаться они больше не могут — значение одно.
    <div
      className="grid scroll-mt-4 grid-cols-[var(--stage-spine-width)_minmax(0,1fr)] gap-x-2"
      data-stage-step=""
      data-testid={testId}
      data-progress-state={tone}
      aria-current={current ? 'step' : undefined}
    >
      <div className="flex flex-col items-center">
        {/* <span
          className={cn(
            'w-px shrink-0',
            // Высота = посадка узла на первую строку заголовка секции.
            current ? 'h-1.5' : 'h-2',
            !first && lineOf(prevTone),
          )}
          aria-hidden
        /> */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'grid shrink-0 place-items-center rounded-full border',
                /* Узел ПЕРЕЕЗЖАЕТ из тона в тон, а не подменяется. Приём
                   закрывает остаток, и в один коммит «Способ оплаты» из
                   активного становится пройденным, а реестр с выдачей — из
                   пунктирных зелёными: без перехода три узла разом меняют и
                   размер (32 → 24), и заливку, и это читается как скачок
                   картинки. С переходом видно САМО СОБЫТИЕ — этап закрылся. */
                'transition-[width,height,background-color,border-color,color] duration-200 ease-out motion-reduce:transition-none',
                heading ? 'size-9' : 'size-8',
                heading && ['ready', 'partial', 'waiting'].includes(tone) ? 'border-accent bg-accent-soft text-accent-fg' : TONE[tone],
              )}
            >
              <Icon
                className={cn(
                  'transition-[width,height] duration-200 ease-out motion-reduce:transition-none',
                  'size-4',
                )}
                aria-hidden
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            {label}
            {status ? <> · {status}</> : null}
          </TooltipContent>
        </Tooltip>
        {!last && (
          <span
            className={cn(
              /* `min-h-4` — ПОЛ длины отрезка.

                 Высоту строки задаёт секция, а отрезок добирает остаток под
                 узлом. У длинной секции этого достаточно, у короткой — нет:
                 шаг реестра до закрытия остатка это одна серая строка, вся
                 строка рельса выходила 30,7 px, из которых 24 занимал узел, и
                 на линию оставалось 6,7 px. Два соседних шага читались
                 слипшимися, а рельс — рваным ровно там, где он обещает
                 продолжение маршрута. Пол держит ритм независимо от того,
                 насколько пуста секция. */
              'w-px min-h-4 flex-1 transition-colors duration-200 ease-out motion-reduce:transition-none',
              lineOf(tone),
            )}
            aria-hidden
          />
        )}
      </div>
      <div className={cn('min-w-0', !last && 'pb-3.5')}>
        {/* Содержимое НИЖЕ узла ростом — центрируется на нём.

            Секция-карточка выше узла и просто заполняет строку, поэтому её
            ничего не двигает. А однострочная подпись — 16 px против узла в
            24 — стояла прижатой к верху и висела на 4 px ВЫШЕ его центра:
            единственный шаг рельса, где узел и его собственный текст смотрели
            в разные стороны (замерено: смещение −4 px при +2,4…+6 у соседей). */}
        <div className="flex min-h-8 flex-col justify-center">
          {heading && <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-h-9 flex-wrap items-center gap-2">
                <h2 className="text-title font-semibold text-fg">{label}</h2>
                {headingStatus && <span className={cn('rounded-md px-2 py-0.5 text-label', tone === 'done' ? 'bg-success-soft text-success-fg' : ['ready', 'partial', 'waiting'].includes(tone) ? 'bg-accent-soft text-accent-fg' : 'bg-muted text-fg')}>{headingStatus}</span>}
              </div>
              {status && <p className="mt-1 text-label text-muted-fg">{status}</p>}
            </div>
            {aside && <div className="flex min-h-9 items-center">{aside}</div>}
          </header>}
          {!heading && status && (
            <p className="mb-1.5 text-label text-muted-fg">{status}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

StageRail.Step = StageRailStep
