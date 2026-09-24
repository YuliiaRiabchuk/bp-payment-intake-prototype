import { Gavel, ReceiptText, Sparkles, Truck } from 'lucide-react'

/** Іконка статті нарахування — за назвою, як `SurchargeLineIcon` у CRM. */
export function ChargeIcon({ article, className = 'size-4 text-muted-fg' }: { article: string; className?: string }) {
  const a = article.toLowerCase()
  const Icon = a.includes('достав')
    ? Truck
    : a.includes('мийк') || a.includes('митт') || a.includes('хімі')
      ? Sparkles
      : a.includes('штраф') || a.includes('пошкод')
        ? Gavel
        : ReceiptText
  return <Icon className={className} aria-hidden />
}
