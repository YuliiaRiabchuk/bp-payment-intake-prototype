import { TooltipProvider } from '@/components/ui/tooltip'
import { RentHeader } from './RentHeader'
import { RentStageStepper } from './RentStageStepper'
import { TargetRail } from './target/TargetRail'
import { PaymentStageLive } from './target/PaymentStageLive'
import { useLab } from '@/lab/lab-state'
import type { Rent } from '@/mock/types'

/**
 * Картка оренди, вкладка «Оренда»: шапка, степер етапів, таймлайн кроку і
 * липкий правий сайдбар (§3 брифу).
 *
 * Скрол живе в області вмісту, а не на документі: успадкований `globals.css`
 * ставить `html { overflow: clip }`, тож сторінка сама не прокручується.
 */
export function RentCard({ rent }: { rent: Rent }) {
  const { stage, setStage } = useLab()

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col overflow-hidden bg-bg">
        <div className="shrink-0 border-b border-border">
          <RentHeader rent={rent} />
        </div>

        <div data-testid="card-scroll" className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 pb-4 pt-3">
            <div className="mx-auto max-w-page rent-grid">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                  <RentStageStepper
                    current={stage}
                    maxStage={rent.maxStage}
                    onStageSelect={setStage}
                    allowAllStages
                  />
                </div>

                {stage === 'payment' ? (
                  <PaymentStageLive rent={rent} />
                ) : (
                  <p className="px-1 text-body text-muted-fg" data-testid="out-of-scope">
                    Цей етап поза скоупом прототипу. Робота — на кроці «Оплата».
                  </p>
                )}
              </div>

              <TargetRail
                rent={rent}
                onAddSurcharge={() => setStage('payment')}
                onOpenMovements={() => undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
