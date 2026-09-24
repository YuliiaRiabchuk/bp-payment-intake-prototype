import { useState } from 'react'
import { CircleAlert, PackageCheck, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { balanceOf, canHandover, handoverStateOf } from '@/domain/money'
import { useStore } from '@/state/store'
import { useLab } from '@/lab/lab-state'
import { SkipPaymentDialog, ZeroDepositDialog } from './HandoverDialogs'

/**
 * Перехід до видачі для варіантів A–D. Окремий регіон з однією первинною
 * кнопкою «До видачі».
 *
 * Стан пишеться реченням, що відповідає «що далі», і НЕ друкує суму: число
 * «скільки ще прийняти» живе на одній головній поверхні кроку (§6). Плашки
 * «Неповна оплата. Залишилося…» тут немає.
 *
 * «Пропустити оплату» бачить тільки керівник і тільки коли без неї не
 * пройти. Де саме їй жити — відкрите питання §12; тут вона стоїть поруч із
 * дією, яку розблоковує.
 */
export function IntakeGate() {
  const { rent, dispatch } = useStore()
  const { role } = useLab()
  const bal = balanceOf(rent)
  const state = handoverStateOf(rent, bal)
  const allowed = canHandover(rent, bal)
  const pendingBank = rent.drafts.some((d) => d.method === 'bank' && d.invoiceId)
  const [zeroOpen, setZeroOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)

  const sentence = !rent.counterparty.requisitesOk
    ? 'Заповніть реквізити контрагента — без них видачу не відкрити.'
    : state === 'settled'
      ? 'Оплату закрито. Можна видавати.'
      : state === 'partial'
        ? 'Внесено частину. Видати можна, решта лишиться боргом клієнта.'
        : rent.handoverAllowed
          ? `Видачу без оплати дозволив ${rent.handoverAllowed.by.toLowerCase()}.`
          : pendingBank
            ? 'Чекаємо переказ. Видача — після підтвердження за квитанцією.'
            : 'Без оплати видати не можна. Дозвіл дає керівник.'

  const go = () => {
    if (bal.deposit.due <= 0) setZeroOpen(true)
    else dispatch({ type: 'HANDOVER' })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="issue-gate">
      <Button variant="ghost" className="text-danger-fg hover:text-danger-fg">
        <X className="size-3.5" aria-hidden />
        Скасувати оренду
      </Button>
      <p
        className={cn(
          'ml-auto flex min-w-0 items-center gap-1.5 text-body',
          allowed ? 'text-fg-2' : 'text-muted-fg',
        )}
        data-testid="gate-sentence"
        aria-live="polite"
      >
        {!allowed && <CircleAlert className="size-3.5 shrink-0" aria-hidden />}
        {sentence}
      </p>
      {state === 'unpaid' && !rent.handoverAllowed && role === 'head' && (
        <Button variant="danger" onClick={() => setSkipOpen(true)} data-testid="skip-payment">
          <ShieldAlert className="size-3.5" aria-hidden />
          Пропустити оплату
        </Button>
      )}
      <Button
        disabled={!allowed}
        onClick={go}
        data-testid="to-handover"
        data-main-action={allowed ? 'handover' : undefined}
      >
        <PackageCheck className="size-3.5" aria-hidden />
        До видачі
      </Button>
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
