import { type ReactNode } from 'react'
import { MoneyBar, type NamedAccount } from './MoneyBar'

/**
 * **Полоса в нескольких моментах подряд** — один объект в N состояниях, а не N
 * экранов с похожим виджетом.
 *
 * Смотреть надо на **правый край первой секции**: он единственный, кто здесь
 * двигается, и каждое его положение — отдельная ситуация домена. Пустая
 * размётка → заполнено → зазор → хвост → вторая секция целиком хвостом → пусто.
 *
 * Сами моменты компонент не выдумывает: сценарий, подписи и числа приходят
 * пропом. Он отвечает только за то, чтобы N снимков стояли в одинаковой раме —
 * иначе разница между состояниями смешивается с разницей их оформления.
 */

export type MoneyBarStage = {
  /** Ключ списка. Заголовки повторяются — по ним ключевать нельзя. */
  key: string
  title: string
  /** Иконка момента. Компонент не выбирает её сам — семья иконок у вызывающего. */
  icon?: ReactNode
  /** Что произошло на этом шаге — словами, потому что пиксель на 3 % не читается. */
  caption?: ReactNode
  first: NamedAccount
  second: NamedAccount
  /** Где стоял край первого счёта до пересчёта — пунктир «было». */
  ghostFirstDue?: number | null
}

export function MoneyBarStages({
  stages,
  compact,
}: {
  stages: MoneyBarStage[]
  /** Тонкая полоса и легенда без состояний — для узкого рейла. */
  compact?: boolean
}) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {stages.map((stage) => (
        <li key={stage.key} className="flex flex-col gap-2 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {stage.icon && (
              <span className="shrink-0 text-muted-fg" aria-hidden>
                {stage.icon}
              </span>
            )}
            <span className="truncate text-body font-semibold text-fg">
              {stage.title}
            </span>
          </div>

          <MoneyBar
            first={stage.first}
            second={stage.second}
            ghostFirstDue={stage.ghostFirstDue ?? null}
            compact={compact}
          />

          {stage.caption && (
            <p className="text-label text-muted-fg">{stage.caption}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
