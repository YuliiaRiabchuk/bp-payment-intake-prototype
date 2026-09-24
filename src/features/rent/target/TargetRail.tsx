import { Check, Phone, Wallet } from 'lucide-react'
import { CollapsibleCard } from '@/components/layout/CollapsibleCard'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { outstandingAmount } from '@/state/rent-store'
import { SidebarMoneyFlow, SidebarMoneyLink } from './SidebarMoney'
import type { Invoice, Rent } from '@/mock/types'

/**
 * Правий сайдбар цільового рішення.
 *
 * Порядок: **гроші → клієнт → обладнання і термін.**
 *
 * Документи і рядки рахунку виїхали у власні таби. Рейл лишається коротким
 * рівнем: він відповідає «скільки», таба — «з чого саме». Тримати обидві
 * копії поруч означало б завести два джерела на один факт.
 *
 * Гроші стоять ПЕРШИМИ, а не в середині. Раніше вони йшли третіми, і кожна
 * нова картка вище відсувала їх нижче: з появою блока клієнта грошова група
 * поїхала на 789px від верху рейла і на ноутбуці 1440×900 опинилась цілком
 * за межею екрана — разом із «Доп. нарахування» і «Прийняти доплату».
 * Порядок за пріоритетом має триматись сам, а не залежати від того, що
 * вставили вище.
 *
 * Наслідок, важливіший за вигляд: порядок у DOM тепер збігається з візуальним
 * на ВСІХ ширинах. Перестановок через `order` немає, тож клавіатура йде тим
 * самим шляхом, що й око. Раніше на вузькому екрані гроші підіймались
 * візуально, а таб вів через довідку.
 *
 * Рейл не має власної висоти і власного скрола. Прокручується область вмісту
 * картки: документ під `html { overflow: clip }` не скролиться взагалі, тож
 * покладатись на скрол сторінки тут не можна.
 */
export function TargetRail({
  rent,
  className,
  onAddSurcharge,
  onOpenMovements,
}: {
  rent: Rent
  className?: string
  onAddSurcharge: () => void
  onOpenMovements: () => void
}) {
  const cp = rent.counterparty
  /**
   * Основний робочий розмір — 1366×768. Це 633px робочої висоти під шапкою,
   * і рейл у 1360px не має шансів вміститись. Тому на низькому екрані
   * найнижча за пріоритетом картка — документи — стартує згорнутою: вона
   * довідка, а не робота, і коштує 260px, які краще віддати грошам і
   * клієнту. На високому екрані ховати нема чого, і вона відкрита.
   */

  return (
    <aside
      data-testid="target-rail"
      className={cn(
        // Каденція, а не один інтервал на всі стики: усередині групи 8px,
        // між групами 20px. Гроші, клієнт, обладнання і документи — різні
        // питання, і пауза між ними має бути довшою за паузу всередині.
        'flex min-w-0 flex-col gap-5 self-start',
        // Поки колонка одна, картки стають у дві: на 1023px рейл ставав
        // смугою в 991px, і пара «Нараховано … 74 160 грн» розліталась по
        // краях так, що переставала читатись парою.
        'max-lg:grid max-lg:grid-cols-1 sm:max-lg:grid-cols-2 sm:max-lg:items-start',
        className,
      )}
    >
      {/* ─── Гроші ─────────────────────────────────────────────────────
          Два рахунки, вхід у нарахування, борг і книга рухів. */}
      <div className="flex flex-col gap-2">
        {/* Рахунок оренди і посилання під ним — одна група зі спільною
            межею. Кнопка приклеєна до картки, а не стоїть окремим блоком:
            вона продовження рахунку, а не другий об'єкт. */}
        <div className="flex flex-col">
          <RailInvoiceCard
            invoice={rent.rentInvoice}
            title="Рахунок оренди"
            rent={rent}
            merged
          />
          <SidebarMoneyLink rent={rent} onAddSurcharge={onAddSurcharge} />
        </div>

        <RailInvoiceCard invoice={rent.depositInvoice} title="Рахунок застави" />

        <SidebarMoneyFlow
          rent={rent}
          onAddSurcharge={onAddSurcharge}
          onOpenMovements={onOpenMovements}
        />
      </div>

      {/* ─── Клієнт ────────────────────────────────────────────────────
          Контакт і історія співпраці — ОДНА картка, а не дві поруч. Двома
          вони читались як одна з випадковою лінією посередині: те саме
          обличчя, той самий контрагент, розведений на «телефон» і «борг». */}
      <CollapsibleCard title="Контрагент">
        <div className="text-body font-medium text-fg">{cp.name}</div>
        <div className="mt-1 flex flex-col gap-0.5 text-label text-muted-fg">
          <span className="flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0" aria-hidden />
            {cp.phone}
          </span>
          {cp.edrpou && (
            <span>
              ЄДРПОУ <span className="font-mono">{cp.edrpou}</span>
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-1.5">
            <Wallet className="size-3.5 shrink-0" aria-hidden />
            Баланс контрагента:
            <span
              className={cn(
                'font-semibold tabular-nums',
                cp.operationalBalance < 0 ? 'text-danger-fg' : 'text-fg',
              )}
            >
              {formatMoney(cp.operationalBalance)}
            </span>
          </span>
        </div>
      </CollapsibleCard>

      {/* ─── Обладнання ────────────────────────────────────────────────── */}
      <CollapsibleCard
        title="Обладнання і термін"
        right={
          <span className="text-label tabular-nums text-muted-fg">
            {rent.issueAt} — {rent.plannedReturnAt}
          </span>
        }
      >
        <div className="flex flex-col gap-1.5">
          {rent.positions.map((p) => (
            // Назва обладнання ПЕРЕНОСИТЬСЯ, а не обрізається. У 320px
            // колонки вона програвала кількості й тарифу і зникала на всіх
            // ширинах, включно з 1920 — а це єдиний рядок, яким менеджер
            // упізнає, що саме взяли. Кількість і тариф ідуть під назву:
            // вони короткі й читаються другим рядком без втрат.
            <div key={p.id} className="flex flex-col">
              <span className="text-body text-fg">{p.name}</span>
              <span className="text-label tabular-nums text-muted-fg">
                {p.qty} шт × {formatMoney(p.pricePerDay)}/доба
              </span>
            </div>
          ))}
        </div>
      </CollapsibleCard>

    </aside>
  )
}

/**
 * Картка рахунку.
 *
 * Коли по оренді є доп. нарахування, вони йдуть ТУТ, рядком під самим
 * рахунком. Раніше «Рух коштів» повторював ті самі два числа іншими
 * словами: «74 160 / оплачено 74 160» у рахунку і «нараховано 74 160 /
 * прийнято 74 160» під ним. Три картки, два факти.
 */
function RailInvoiceCard({
  invoice,
  title,
  rent,
  merged,
}: {
  invoice: Invoice
  title: string
  rent?: Rent
  /** Знизу до картки приклеєна кнопка — межу і заокруглення віддаємо їй. */
  merged?: boolean
}) {
  /**
   * Галочка «Оплачений» дивиться на РАХУНОК ЦІЛКОМ, а не лише на базу.
   *
   * Раніше вона тримала тільки `invoice.paid >= invoice.total` і на рахунку
   * оренди показувала зелену галочку зі стовідсотковою смугою, поки в
   * сайдбарі поруч стояло «До доплати 1 800 грн». Формально правда про базу,
   * але на екрані це читається як «розрахунок закритий».
   */
  const outstanding = rent ? outstandingAmount(rent) : 0
  const paid = invoice.total > 0 && invoice.paid >= invoice.total && outstanding === 0
  const pct =
    invoice.total > 0
      ? Math.min(100, Math.round((invoice.paid / invoice.total) * 100))
      : 0
  const remainder = Math.max(0, invoice.total - invoice.paid)
  const surcharged = rent
    ? rent.surcharges
        .filter((s) => s.status !== 'cancelled' && s.kind !== 'overdue')
        .reduce((sum, s) => sum + s.amount, 0)
    : 0

  return (
    <CollapsibleCard
      title={title}
      className={merged ? 'rounded-b-none border-b-0' : undefined}
      right={
        <>
          {invoice.vat && (
            <Badge variant="outline">
              {invoice.vat === 'with' ? 'з ПДВ' : 'без ПДВ'}
            </Badge>
          )}
          {paid && (
            <span className="grid size-5 place-items-center rounded-full border border-success bg-success text-white">
              <Check className="size-3" strokeWidth={3} aria-hidden />
              <span className="sr-only">Оплачений</span>
            </span>
          )}
        </>
      }
    >
      <div className="text-headline font-semibold tabular-nums text-fg">
        {formatMoney(invoice.total)}
      </div>
      {/* Нуль — не порожнеча, а рішення, яке хтось прийняв. Застава 0 видачу
          не блокує (рішення 26.08.2026), але мовчати про неї не можна: без
          підпису картка виглядає недозаповненою, і менеджер шукає, що
          зламалось. Смуга при нулі не малюється — ділити на нуль нема чого. */}
      {invoice.total === 0 && (
        <p
          data-testid="zero-invoice-note"
          className="mt-1 text-label text-warning-fg"
        >
          {title.includes('застав')
            ? 'Застава не береться — видачу не блокує'
            : 'Рахунок нульовий'}
        </p>
      )}
      {invoice.total > 0 && (
        <div
          className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-danger-soft"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-success transition-[width] duration-700 ease-expo-out motion-reduce:transition-none"
            style={{ width: pct + '%' }}
          />
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-label text-muted-fg">
        <span className="tabular-nums">Оплачено {formatMoney(invoice.paid)}</span>
        {remainder > 0 && (
          <span className="font-medium tabular-nums text-danger-fg">
            Залишок {formatMoney(remainder)}
          </span>
        )}
      </div>
      {/* Доп. нарахування — ПОЗА цим рахунком, і рядок має це казати.
          Раніше він стояв між «Оплачено» і рядками рахунку, тобто просто
          посеред їхньої арифметики: 1 200 − 600 = 600 сходилось, а 500
          висіло тут же і не належало ні до чого. Тепер він іде після
          рядків, за власною межею і з підписом, який називає його
          окремими грошима. Сума не дублюється: у рахунку її немає. */}
      {surcharged > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 text-label text-muted-fg">
              Доп. нарахування поза рахунком
            </span>
            <span className="shrink-0 text-label font-semibold tabular-nums text-fg-2">
              {formatMoney(surcharged)}
            </span>
          </div>
        </div>
      )}
    </CollapsibleCard>
  )
}
