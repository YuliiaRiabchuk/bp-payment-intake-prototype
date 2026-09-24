import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney } from '@/lib/money'
import { useStore } from '@/state/store'
import type { Charge } from '@/mock/types'

/**
 * Скасування нарахування з обов'язковою причиною. Порт `SurchargeCancelDialog`:
 * кнопка небезпечної дії неактивна, поки причина порожня. Запис лишається в
 * секції скасованих (§6).
 */
export function CancelChargeDialog({
  charge,
  onClose,
}: {
  charge: Charge | null
  onClose: () => void
}) {
  const { dispatch } = useStore()
  const [reason, setReason] = useState('')
  const open = !!charge
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setReason('')
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md" data-testid="cancel-charge-dialog">
        <DialogHeader>
          <DialogTitle>Скасувати нарахування?</DialogTitle>
          <DialogDescription>
            {charge?.article} — {formatMoney(charge?.net ?? 0)} без ПДВ
          </DialogDescription>
        </DialogHeader>
        <p className="text-body text-fg-2">
          Нарахування та його ПДВ буде знято з боргу. Причина збережеться в історії. Сформований рахунок потрібно буде оновити.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-label text-fg-2">
            Причина скасування<span className="text-danger-fg"> *</span>
          </span>
          <Textarea
            autoFocus
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="cancel-charge-reason"
          />
        </label>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Назад
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={() => {
              if (!charge) return
              dispatch({ type: 'CHARGE_CANCEL', id: charge.id, reason: reason.trim() })
              setReason('')
              onClose()
            }}
            data-testid="cancel-charge-confirm"
          >
            Скасувати нарахування
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
