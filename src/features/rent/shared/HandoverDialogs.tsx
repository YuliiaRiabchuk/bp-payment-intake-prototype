import { ShieldAlert, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney } from '@/lib/money'

/**
 * Діалоги переходу до видачі — спільні для всіх варіантів. Правила §5:
 *  - застава 0 — блокуючий діалог з великим текстом і явним підтвердженням,
 *    без чекбокса та інлайн-плашки;
 *  - видача без оплати — тільки керівник, дозвіл і ім'я пишуться в хронологію.
 */

export function ZeroDepositDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md" data-testid="zero-deposit-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warning-fg" aria-hidden />
            Заставу не прийнято
          </DialogTitle>
          <DialogDescription>Обладнання піде клієнту без застави.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5">
          <ShieldCheck className="size-4 shrink-0 text-warning-fg" aria-hidden />
          <span className="text-body text-fg-2">Застава</span>
          <span className="ml-auto flex items-center gap-1.5 text-headline font-semibold tabular-nums text-warning-fg">
            <TriangleAlert className="size-4" aria-hidden />0 грн
          </span>
        </div>
        <p className="text-title font-semibold text-fg">Все одно перейти до видачі?</p>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Повернутись до оплати
          </Button>
          <Button onClick={onConfirm} data-testid="zero-deposit-confirm">
            Перейти до видачі без застави
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SkipPaymentDialog({
  open,
  due,
  onCancel,
  onConfirm,
}: {
  open: boolean
  due: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md" data-testid="skip-payment-dialog">
        <DialogHeader>
          <DialogTitle>Дозволити видачу з боргом?</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <Wallet className="size-4 text-muted-fg" aria-hidden />
          <span className="text-body text-fg-2">Залишилося сплатити</span>
          <span className="ml-auto text-headline font-semibold tabular-nums text-danger-fg">{formatMoney(due)}</span>
        </div>
        <p className="text-body text-fg-2">
          Борг зберігається. Дозвіл і ваше ім’я з’являться в хронології оренди. Перед видачею потрібно виконати решту перевірок.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Скасувати
          </Button>
          <Button variant="danger" onClick={onConfirm} data-testid="skip-payment-confirm">
            <ShieldAlert className="size-3.5" aria-hidden />
            Пропустити оплату
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
