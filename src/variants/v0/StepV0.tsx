import { useState } from 'react'
import {
  ArrowRight,
  CircleDot,
  CircleHelp,
  ClipboardList,
  HandCoins,
  PackageCheck,
  Plus,
  Receipt,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoney } from '@/lib/money'
import { acceptedTotal, balanceOf, canHandover, handoverStateOf } from '@/domain/money'
import { useStore } from '@/state/store'
import { useLab } from '@/lab/lab-state'
import { useCard } from '@/features/rent/card-context'
import { StageRail } from '@/features/rent/StageRail'
import { SkipPaymentDialog, ZeroDepositDialog } from '@/features/rent/shared/HandoverDialogs'
import { plural } from '@/lib/plural'
import { InvoicesV0 } from './InvoicesV0'
import { ChargesV0, chargesNode } from './ChargesV0'
import { MethodsV0, intakeNode } from './MethodsV0'

/**
 * Варіант 0 — крок «Оплата» чинного проду.
 *
 * Антиреференс і база вимірів. Відтворено разом із вадами, які описує §4
 * брифу: сума «скільки ще» на п'яти поверхнях, поповер-майстер, що міняє
 * зміст, рядок, що розгортається на пів екрана, «крок 1 з 2» для
 * автоматичного ПКО і плашка «Неповна оплата» біля «До видачі».
 */
export function StepV0() {
  const { rent } = useStore()
  const { chargeForm, openChargeForm } = useCard()
  const bal = balanceOf(rent)
  const anyPayment = rent.payments.some((p) => !p.annulled)
  const charges = chargesNode(rent, bal, !!chargeForm)
  const intake = intakeNode(bal, anyPayment)
  const payments = rent.payments.filter((p) => !p.annulled)

  return (
    <StageRail testId="payment-stage">
      <StageRail.Step key="invoices" tone="done" icon={Receipt} label="Рахунки до оплати" heading>
        <InvoicesV0 />
      </StageRail.Step>

      <StageRail.Step
        key="charges"
        tone={charges.tone}
        icon={CircleDot}
        label="Дод. нарахування"
        heading
        headingStatus={charges.pill}
        aside={
          !chargeForm && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => openChargeForm('charge')} data-testid="add-charge">
                <Plus className="size-3.5" aria-hidden />
                Додати нарахування
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openChargeForm('discount')} data-testid="add-discount">
                <Plus className="size-3.5" aria-hidden />
                Додати знижку
              </Button>
            </div>
          )
        }
      >
        <ChargesV0 />
      </StageRail.Step>

      <StageRail.Step
        key="intake"
        tone={intake.tone}
        icon={HandCoins}
        label="Прийом коштів"
        heading
        headingStatus={intake.pill}
        aside={
          <span className="text-headline font-medium tabular-nums" data-remaining="step-heading">
            <span className="sr-only">До приймання: </span>
            {formatMoney(bal.remaining)}
          </span>
        }
        testId="step-intake"
      >
        <div data-step="intake">
          <MethodsV0 />
        </div>
      </StageRail.Step>

      <StageRail.Step key="registry" tone={bal.remaining <= 0 ? 'done' : 'idle'} icon={ClipboardList} label="Реєстр платежів">
        <div className="flex flex-wrap items-center gap-x-2 text-body" data-testid="registry-row">
          {payments.length === 0 ? (
            <span className="text-muted-fg">Платежів ще не було</span>
          ) : (
            <span>
              Прийнято <span className="font-semibold tabular-nums">{formatMoney(acceptedTotal(rent))}</span> за{' '}
              {payments.length} {plural(payments.length, 'платіж', 'платежі', 'платежів')}
            </span>
          )}
          <span className="flex items-center gap-1 font-medium underline underline-offset-2">
            Реєстр платежів <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </StageRail.Step>

      <StageRail.Step key="issue" tone={bal.remaining <= 0 ? 'done' : 'idle'} icon={PackageCheck} label="Видача">
        <IssueGateV0 />
      </StageRail.Step>
    </StageRail>
  )
}

/** Порт `IssueGate` + `UnpaidHandoverAction`. */
function IssueGateV0() {
  const { rent, dispatch } = useStore()
  const { role } = useLab()
  const bal = balanceOf(rent)
  const state = handoverStateOf(rent, bal)
  const allowed = canHandover(rent, bal)
  const [zeroOpen, setZeroOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)

  const go = () => {
    if (bal.deposit.due <= 0) setZeroOpen(true)
    else dispatch({ type: 'HANDOVER' })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="issue-gate">
      <Button variant="ghost" className="text-danger-fg hover:text-danger-fg">
        <X className="size-3.5" aria-hidden />
        Скасувати оренду
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'partial' && (
          <span
            className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning-soft px-2.5 py-1.5 text-label text-warning-fg"
            data-testid="partial-plaque"
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            Неповна оплата. Залишилося сплатити:{' '}
            <span className="font-semibold tabular-nums" data-remaining="plaque">
              {formatMoney(bal.remaining)}
            </span>
          </span>
        )}
        {state === 'unpaid' && rent.handoverAllowed && (
          <span className="text-label text-warning-fg">
            Видачу з боргом дозволено. Залишилося сплатити: {formatMoney(bal.remaining)}.
          </span>
        )}
        {state === 'unpaid' && !rent.handoverAllowed && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Як видати з боргом">
                  <CircleHelp className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Прийміть оплату або передайте номер оренди керівнику для дозволу видачі з боргом.
              </TooltipContent>
            </Tooltip>
            {role === 'head' && (
              <Button variant="danger" onClick={() => setSkipOpen(true)} data-testid="skip-payment">
                <ShieldAlert className="size-3.5" aria-hidden />
                Пропустити оплату
              </Button>
            )}
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button disabled={!allowed} onClick={go} data-testid="to-handover" data-main-action={allowed ? 'handover' : undefined}>
                <PackageCheck className="size-3.5" aria-hidden />
                До видачі
              </Button>
            </span>
          </TooltipTrigger>
          {!allowed && <TooltipContent>Не вистачає {formatMoney(bal.remaining)}</TooltipContent>}
        </Tooltip>
      </div>
      <ZeroDepositDialog
        open={zeroOpen}
        onCancel={() => setZeroOpen(false)}
        onConfirm={() => {
          setZeroOpen(false)
          dispatch({ type: 'HANDOVER' })
        }}
      />
      <SkipPaymentDialog
        open={skipOpen}
        due={bal.remaining}
        onCancel={() => setSkipOpen(false)}
        onConfirm={() => {
          setSkipOpen(false)
          dispatch({ type: 'ALLOW_HANDOVER' })
        }}
      />
    </div>
  )
}
