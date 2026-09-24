import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RENT_STAGES, rentStageIndex } from './stages'
import type { RentStageKey } from '@/mock/types'

/**
 * The rent-lifecycle spine — a horizontal 5-stage stepper (D2), v2 (юзер 09.07).
 *
 * Два независимых сигнала:
 *  - **Фронтир** (`maxStage`) — самый дальний ФАКТИЧЕСКИ достигнутый этап.
 *    Всё слева от него (включительно) — «яркая» зона: пройденные этапы
 *    зелёные с галочкой, фронтир — accent-нода; всё правее приглушено (ещё
 *    недостижимо).
 *  - **Просмотр** (`current`) — какой этап открыт в фокус-зоне. Отмечается
 *    accent-пилюлей вокруг ноды+лейбла; по достигнутым этапам можно ходить.
 *
 * Анимации: заливка коннекторов и галочки зависят ТОЛЬКО от фронтира —
 * поэтому анимация играет исключительно при реальном продвижении вперёд
 * (фронтир вырос). Навигация назад/между достигнутыми этапами двигает лишь
 * пилюлю просмотра — без «отката» прогресса (юзер 09.07: rollback-анимация
 * мислидит). Пилюля не прыгает: геометрия (паддинги) у всех нод постоянная,
 * анимируется только цвет фона — переход читается кросс-фейдом старой и
 * новой пилюли (200ms, product-register).
 *
 * `cancelledStage` — off-spine CANCELLED: красный X-маркер на этапе обрыва,
 * до него done, после — недостижимо; фронтир/просмотр игнорируются.
 */
interface RentStageStepperProps {
  current: RentStageKey
  onStageSelect?: (stage: RentStageKey) => void
  /** Allow clicking future (todo) stages — for prototype/preview mode only. */
  allowAllStages?: boolean
  /** Самый дальний достигнутый этап аренды (фронтир). По умолчанию = `current`. */
  maxStage?: RentStageKey
  /** Этап, на котором аренда ОТМЕНЕНА (off-spine CANCELLED). */
  cancelledStage?: RentStageKey
  /**
   * Етап, З ЯКОГО прийшли по справі (доручення). Малюється тонким кільцем
   * на своїй ноді: дорога назад має бути видима на самому хребті, а не лише
   * в смузі під ним. Степер тоді каже «ви відійшли і ось звідки», а не «вас
   * відкотило».
   */
  originStage?: RentStageKey
  className?: string
}

type NodeState = 'done' | 'frontier' | 'todo' | 'cancelled'

export function RentStageStepper({
  current,
  onStageSelect,
  allowAllStages,
  maxStage,
  cancelledStage,
  originStage,
  className,
}: RentStageStepperProps) {
  const interactive = !!onStageSelect
  const viewedIdx = rentStageIndex(current)
  const maxIdx = Math.max(
    maxStage ? rentStageIndex(maxStage) : viewedIdx,
    viewedIdx,
  )
  const cancelledIdx = cancelledStage ? rentStageIndex(cancelledStage) : -1
  const originIdx = originStage ? rentStageIndex(originStage) : -1

  return (
    <div className={cn('flex items-center', className)}>
      {RENT_STAGES.map((s, i) => {
        // Состояние ноды — относительно ФРОНТИРА (не просмотра): назад-
        // навигация не перекрашивает спайн. Отменённая аренда — свой маркер.
        const state: NodeState =
          cancelledStage != null
            ? i < cancelledIdx
              ? 'done'
              : i === cancelledIdx
                ? 'cancelled'
                : 'todo'
            : i < maxIdx
              ? 'done'
              : i === maxIdx
                ? 'frontier'
                : 'todo'
        const isViewed = cancelledStage == null && i === viewedIdx
        const isOrigin = i === originIdx && i !== viewedIdx
        const reached =
          cancelledStage != null ? i <= cancelledIdx : i <= maxIdx
        const clickable = interactive && (reached || !!allowAllStages)
        // Недостижимые этапы — приглушены: яркая зона читается как «здесь
        // уже можно ходить», серая — «ещё не время».
        const dimmed = state === 'todo'
        // Геометрия пилюли (px/py) — у ВСЕХ нод, всегда: переход просмотра
        // не двигает layout, анимируется только background (кросс-фейд).
        const nodeClass = cn(
          'group flex items-center gap-2.5 rounded-full px-2.5 py-1 -my-1',
          'transition-[background-color,opacity] duration-200 ease-out motion-reduce:transition-none',
          clickable &&
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg',
          // Пилюля просмотра — «вы сейчас смотрите этот этап».
          isViewed && 'bg-accent-soft/60',
          state === 'cancelled' && 'bg-danger-soft/60',
          // Прозорість — мова ВИМКНЕНОГО контрола: `button.tsx` малює
          // `disabled:opacity-55`. Клікабельний етап попереду вимкненим не є,
          // тож приглушується кольором, а не прозорістю; справді недосяжний
          // лишається напівпрозорим і читається як недоступний.
          dimmed && !clickable && 'opacity-40',
        )
        const connectorFilled =
          cancelledStage != null ? i < cancelledIdx : i < maxIdx
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStageSelect?.(s.key)}
                className={nodeClass}
                aria-current={isViewed ? 'step' : undefined}
              >
                <StageNode
                  stageKey={s.key}
                  state={state}
                  viewed={isViewed}
                  origin={isOrigin}
                  index={i}
                  label={s.label}
                  interactive
                />
              </button>
            ) : (
              <div
                className={nodeClass}
                aria-current={isViewed ? 'step' : undefined}
              >
                <StageNode
                  stageKey={s.key}
                  state={state}
                  viewed={isViewed}
                  origin={isOrigin}
                  index={i}
                  label={s.label}
                />
              </div>
            )}
            {i < RENT_STAGES.length - 1 ? (
              <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                {/* Заливка зависит ТОЛЬКО от фронтира → transition играет
                    исключительно на реальном продвижении вперёд. */}
                <div
                  className={cn(
                    'h-full origin-left rounded-full bg-success transition-transform duration-500 ease-expo-out motion-reduce:transition-none',
                    connectorFilled ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function StageNode({
  state,
  viewed,
  origin,
  stageKey,
  index,
  label,
  interactive,
}: {
  state: NodeState
  /** Этап открыт в фокус-зоне (пилюля просмотра). */
  viewed?: boolean
  /** Етап, з якого прийшли по справі. */
  origin?: boolean
  stageKey: RentStageKey
  index: number
  label: string
  interactive?: boolean
}) {
  return (
    <>
      <span
        data-testid={`stage-node-${stageKey}`}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full text-mono font-semibold tabular-nums transition-colors duration-200',
          state === 'done' && 'bg-success text-white',
          state === 'frontier' && 'bg-accent text-white ring-2 ring-accent-soft',
          state === 'cancelled' && 'bg-danger text-white ring-2 ring-danger-soft',
          // `opacity-55` — те, чим система малює ВИМКНЕНИЙ контрол
          // (`button.tsx`). Етап попереду вимкненим не є: він клікається і
          // веде. Приглушення лишається кольором, не прозорістю.
          state === 'todo' && 'border border-border-strong bg-card text-muted-fg',
          state === 'todo' &&
            interactive &&
            'group-hover:border-fg-2 group-hover:text-fg-2',
          // Кільце походження: не змінює стан ноди, лише каже «сюди назад».
          // Колір темний, а не акцентний: найчастіший випадок — прийшли саме
          // з фронтиру, а фронтир сам залитий акцентом, і акцентне кільце на
          // ньому зникає рівно тоді, коли потрібне найбільше.
          origin && 'ring-2 ring-fg ring-offset-2 ring-offset-card',
        )}
      >
        {state === 'done' ? (
          <Check className="size-3.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-50 motion-safe:duration-250 motion-safe:ease-expo-out" />
        ) : state === 'cancelled' ? (
          <X className="size-3.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-50 motion-safe:duration-250 motion-safe:ease-expo-out" />
        ) : (
          index + 1
        )}
      </span>
      <span
        className={cn(
          'whitespace-nowrap text-body transition-colors',
          viewed && 'font-semibold text-fg',
          state === 'cancelled' && 'font-semibold text-danger-fg',
          // Фронтир читается «последним» и без пилюли — тёмный лейбл.
          !viewed && state === 'frontier' && 'font-medium text-fg',
          !viewed && (state === 'done' || state === 'todo') && 'text-muted-fg',
          !viewed &&
            state !== 'cancelled' &&
            interactive &&
            'group-hover:text-fg',
        )}
      >
        {label}
      </span>
    </>
  )
}
