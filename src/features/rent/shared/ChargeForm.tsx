import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMoney } from '@/lib/money'
import { balanceOf, gross, rentVatRate } from '@/domain/money'
import { useStore } from '@/state/store'
import type { Charge } from '@/mock/types'

/**
 * Інлайн-форма нарахування або знижки. Порт `SurchargeForm` CRM: стаття,
 * обладнання, коментар ліворуч; сума без ПДВ, «Враховувати ПДВ» і
 * передрахунок праворуч. Одна форма на екран: вхід із сайдбару веде сюди ж
 * (§5: другої копії блоку немає).
 */

const CHARGE_ARTICLES: { name: string; vatable: boolean }[] = [
  { name: 'Доставка', vatable: false },
  { name: 'Витрати на хімію', vatable: true },
  { name: 'Миття обладнання', vatable: true },
  { name: 'Пошкодження обладнання', vatable: true },
  { name: 'Штрафні санкції за прострочення', vatable: false },
]

const DISCOUNT_ARTICLES = ['Знижка постійному клієнту', 'Акція', 'Затримка доставки']

export function ChargeForm({
  kind,
  onDone,
  onCancel,
}: {
  kind: Charge['kind']
  onDone: () => void
  onCancel: () => void
}) {
  const { rent, dispatch } = useStore()
  const rate = rentVatRate(rent)
  const bal = balanceOf(rent)
  const [article, setArticle] = useState<string>('')
  const [target, setTarget] = useState('Уся оренда')
  const [comment, setComment] = useState('')
  const [raw, setRaw] = useState('')
  const [vatable, setVatable] = useState(true)
  const [touched, setTouched] = useState(false)
  const net = Number(raw.replace(/\s/g, '').replace(',', '.')) || 0
  // Знижка не може перевищувати внесене і не опускає оренду нижче нуля.
  const maxDiscount = Math.min(bal.rent.due, Math.max(bal.rent.paid, bal.rent.due))
  const effectiveVat = kind === 'charge' && vatable ? rate : 0
  const total = gross(net, effectiveVat)

  const errors = {
    article: !article ? 'Без статті витрат запис не буде проведено в 1С.' : null,
    amount:
      net <= 0
        ? kind === 'charge'
          ? 'Вкажіть суму нарахування більшу за нуль.'
          : 'Вкажіть суму знижки більшу за нуль.'
        : kind === 'discount' && net > maxDiscount
          ? `Знижка більша за доступну: максимум ${formatMoney(maxDiscount)}.`
          : null,
    reason: kind === 'discount' && comment.trim().length < 3 ? 'Вкажіть причину знижки — від 3 до 500 символів.' : null,
  }
  const valid = !errors.article && !errors.amount && !errors.reason

  const submit = () => {
    setTouched(true)
    if (!valid) return
    dispatch({
      type: 'CHARGE_ADD',
      kind,
      article,
      target,
      net,
      vatable: kind === 'charge' ? vatable : false,
      comment: comment.trim() || undefined,
    })
    onDone()
  }

  const pickArticle = (name: string) => {
    setArticle(name)
    const a = CHARGE_ARTICLES.find((x) => x.name === name)
    if (a) setVatable(a.vatable)
  }

  return (
    <section
      className="rounded-lg bg-card p-4 ring-2 ring-fg"
      data-testid="charge-form"
      aria-label={kind === 'charge' ? 'Нове нарахування' : 'Нова знижка'}
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-fg text-primary-fg">
          <Pencil className="size-3.5" aria-hidden />
        </span>
        <span className="text-body font-semibold">{kind === 'charge' ? 'Нове нарахування' : 'Нова знижка'}</span>
        <span className="text-label text-muted-fg">Не збережено</span>
      </header>
      <div className="grid gap-4 @container sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <Field label="Стаття витрат" required error={touched ? errors.article : null}>
            <Select value={article} onValueChange={pickArticle}>
              <SelectTrigger aria-label="Стаття витрат" data-testid="charge-article">
                <SelectValue placeholder="Виберіть статтю" />
              </SelectTrigger>
              <SelectContent>
                {(kind === 'charge' ? CHARGE_ARTICLES.map((a) => a.name) : DISCOUNT_ARTICLES).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {kind === 'charge' && (
            <Field label="Обладнання">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger aria-label="Обладнання">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Уся оренда">Уся оренда</SelectItem>
                  {rent.positions.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field
            label={kind === 'charge' ? "Коментар (необов'язково)" : 'Причина знижки'}
            required={kind === 'discount'}
            error={touched ? errors.reason : null}
          >
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={kind === 'charge' ? 'За що нарахування: доставка, пошкодження, миття…' : 'Чому надано знижку'}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-3">
          <Field label={kind === 'charge' ? 'Сума без ПДВ' : 'Сума знижки'} required error={touched ? errors.amount : null}>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="pr-7 text-right tabular-nums"
                data-testid="charge-amount"
                aria-label={kind === 'charge' ? 'Сума без ПДВ' : 'Сума знижки'}
              />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-body text-muted-fg">₴</span>
            </div>
          </Field>
          {kind === 'charge' ? (
            <>
              <label className="flex items-center gap-2 text-body">
                <Checkbox checked={vatable} onCheckedChange={(v) => setVatable(v === true)} />
                Враховувати ПДВ
              </label>
              <p className="-mt-2 text-label text-muted-fg">
                {vatable ? 'ПДВ додається до суми зверху' : 'Вибрана стаття не оподатковується ПДВ'}
              </p>
              <dl className="flex flex-col gap-1 border-t border-border pt-2 text-label">
                <Row label="Без ПДВ" value={formatMoney(net)} />
                <Row label={`ПДВ ${effectiveVat}%`} value={formatMoney(total - net)} />
                <Row label="Разом до нарахування" value={formatMoney(total)} strong />
              </dl>
              {rent.party === 'ul' && (
                <p className="text-label text-muted-fg">
                  Розрахунок за поточним рахунком. При виборі отримувача оплати ПДВ може змінитися.
                </p>
              )}
            </>
          ) : (
            <p className="text-label text-muted-fg">
              Максимальна знижка <span className="font-semibold tabular-nums text-fg">{formatMoney(maxDiscount)}</span>. Застава до розрахунку не входить.
            </p>
          )}
        </div>
      </div>
      <footer className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onCancel}>
          Скасувати
        </Button>
        <Button onClick={submit} data-testid="charge-submit">
          {kind === 'charge' ? 'Додати нарахування' : 'Додати знижку'}
        </Button>
      </footer>
    </section>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label text-fg-2">
        {label}
        {required && <span className="text-danger-fg"> *</span>}
      </span>
      {children}
      {error && <span className="text-label text-danger-fg">{error}</span>}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-fg">{label}</dt>
      <dd className={strong ? 'font-semibold tabular-nums text-fg' : 'tabular-nums text-fg'}>{value}</dd>
    </div>
  )
}
