import { ClipboardList, HandCoins, ReceiptText } from 'lucide-react'
import { FormSection } from '@/components/layout/FormSection'
import { formatMoney } from '@/lib/money'
import { StageRail } from '../StageRail'
import type { Rent } from '@/mock/types'

/**
 * Крок «Оплата» — каркас.
 *
 * Етап 0 тримає тільки анатомію таймлайну з §3 брифу: «Рахунки до оплати» →
 * «Прийом коштів» → рядок реєстру платежів. Вміст кроків приходить на
 * етапі 2 (порт чинного проду, варіант 0) і далі варіантами A–D.
 */
export function PaymentStageLive({ rent }: { rent: Rent }) {
  const toAccept =
    rent.rentInvoice.total -
    rent.rentInvoice.paid +
    (rent.depositInvoice.total - rent.depositInvoice.paid)

  return (
    <StageRail testId="payment-stage">
      <StageRail.Step key="invoices" tone="done" icon={ReceiptText} label="Рахунки до оплати">
        <FormSection title="Рахунки до оплати">
          <div className="grid grid-cols-2 gap-3">
            <InvoiceStub title="Рахунок оренди" amount={rent.rentInvoice.total} />
            <InvoiceStub title="Рахунок застави" amount={rent.depositInvoice.total} />
          </div>
        </FormSection>
      </StageRail.Step>

      <StageRail.Step key="intake" tone="current" icon={HandCoins} label="Прийом коштів">
        <FormSection
          title="Прийом коштів"
          right={
            <span className="text-headline font-semibold tabular-nums">
              {formatMoney(toAccept)}
            </span>
          }
        >
          <p className="text-body text-muted-fg">
            Каркас. Порт чинного кроку з'явиться на етапі 2.
          </p>
        </FormSection>
      </StageRail.Step>

      <StageRail.Step key="registry" tone="idle" icon={ClipboardList} label="Реєстр платежів">
        <span className="text-body text-muted-fg">Платежів ще не було</span>
      </StageRail.Step>
    </StageRail>
  )
}

function InvoiceStub({ title, amount }: { title: string; amount: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-body text-fg-2">{title}</div>
      <div className="mt-1 text-title font-semibold tabular-nums">{formatMoney(amount)}</div>
    </div>
  )
}
