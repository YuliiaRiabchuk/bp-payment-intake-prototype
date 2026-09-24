import { useCallback, useMemo, useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RentHeader } from './RentHeader'
import { RentStageStepper } from './RentStageStepper'
import { CardContext, type CardActions } from './card-context'
import { Chronology } from './shared/Chronology'
import { canHandover } from '@/domain/money'
import { useLab } from '@/lab/lab-state'
import { useStore } from '@/state/store'
import { RAILS, STEPS } from '@/variants/registry'
import type { Charge } from '@/mock/types'

/**
 * Картка оренди, вкладка «Оренда»: шапка з табами, степер етапів, крок
 * «Оплата» варіанта X і липкий правий сайдбар варіанта Y (§3).
 *
 * Крок і сайдбар — незалежні осі: будь-який варіант кроку поєднується з
 * будь-яким сайдбаром. Спільне між ними — стор (гроші) і `CardContext`
 * (форма нарахування, хронологія, прев'ю суми).
 *
 * Скрол живе в області вмісту: `globals.css` ставить `html { overflow: clip }`.
 */
export function RentCard() {
  const { step, rail, stage, setStage } = useLab()
  const { rent, dispatch } = useStore()
  const [chargeForm, setChargeForm] = useState<Charge['kind'] | null>(null)
  const [chronology, setChronology] = useState(false)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)

  const Step = STEPS[step] ?? STEPS['0']
  const Rail = RAILS[rail] ?? RAILS['0']
  const railOwnsRemaining = rail === 'C'

  const openChargeForm = useCallback(
    (kind: Charge['kind']) => {
      setStage('payment')
      setChargeForm(kind)
      // Ведемо до форми: вона з'являється в кроці, а не в сайдбарі.
      window.requestAnimationFrame(() =>
        document.querySelector('[data-testid="charge-form"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      )
    },
    [setStage],
  )

  const actions = useMemo<CardActions>(
    () => ({
      chargeForm,
      openChargeForm,
      closeChargeForm: () => setChargeForm(null),
      openChronology: () => setChronology(true),
      pendingAmount,
      setPendingAmount,
      railOwnsRemaining,
    }),
    [chargeForm, openChargeForm, pendingAmount, railOwnsRemaining],
  )

  const shownStage = rent.handedOver ? 'handover' : stage

  return (
    <CardContext.Provider value={actions}>
      <TooltipProvider delayDuration={150}>
        <div className="flex h-full flex-col overflow-hidden bg-bg">
          <div className="shrink-0 border-b border-border">
            <RentHeader
              rent={rent}
              onOpenTimeline={() => setChronology(true)}
              nowAction={step === '0' && canHandover(rent) && !rent.handedOver}
              onNowAction={() => dispatch({ type: 'HANDOVER' })}
            />
          </div>

          <div data-testid="card-scroll" className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 pb-6 pt-3">
              <div className="mx-auto flex max-w-page flex-col gap-3">
                <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                  <RentStageStepper
                    current={shownStage}
                    maxStage={rent.handedOver ? 'handover' : 'payment'}
                    onStageSelect={setStage}
                    allowAllStages
                  />
                </div>
                <div className="rent-grid">
                  <div className="min-w-0" data-testid="step-column">
                    {shownStage === 'payment' ? (
                      <Step />
                    ) : rent.handedOver ? (
                      <HandedOver />
                    ) : (
                      <p className="px-1 py-4 text-body text-muted-fg" data-testid="out-of-scope">
                        Цей етап поза скоупом прототипу. Робота — на кроці «Оплата».
                      </p>
                    )}
                  </div>
                  <aside
                    className="min-w-0 self-start lg:sticky lg:top-0"
                    data-testid="rail"
                    aria-label="Розрахунки по оренді"
                  >
                    <Rail />
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Chronology open={chronology} onClose={() => setChronology(false)} />
      </TooltipProvider>
    </CardContext.Provider>
  )
}

function HandedOver() {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
      data-testid="handed-over"
    >
      <span className="grid size-8 place-items-center rounded-full bg-success text-white">
        <PackageCheck className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-body font-medium text-fg">Оренду передано до видачі</p>
        <p className="text-label text-muted-fg">Етап «Видача» поза скоупом прототипу. Щоб повторити сцену, оберіть її у віджеті.</p>
      </div>
    </div>
  )
}
