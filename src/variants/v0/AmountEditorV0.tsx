import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatAmount, formatMoney } from '@/lib/money'

/**
 * Варіант 0 — поле суми з поповером пресетів (кадри 5, 6).
 *
 * Порт `AmountEditor` CRM: плейсхолдер — увесь залишок; на фокус
 * відкривається список «Увесь залишок / Оренда / Застава» і рядок
 * «лишиться прийняти X»; після пресета — чорна ✓. Поповер ховається, щойно
 * менеджер друкує. На кадрі 6 саме він накриває розгорнуту панель.
 */

export interface Preset {
  key: string
  label: string
  amount: number
  target?: 'auto' | 'rent' | 'deposit'
}

export function AmountEditorV0({
  value,
  room,
  placeholder,
  presets,
  onCommit,
  onPreset,
  focusSignal,
  disabled,
  draftId,
  mainAction,
}: {
  value: number
  room: number
  placeholder: number
  presets: Preset[]
  onCommit: (v: number) => void
  onPreset: (p: Preset) => void
  focusSignal: number
  disabled?: boolean
  draftId: string
  /** Поле — наступне, що треба зробити (для виміру головної дії). */
  mainAction?: boolean
}) {
  const [text, setText] = useState(value ? formatAmount(value) : '')
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [presetPicked, setPresetPicked] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setText(value ? formatAmount(value) : '')
  }, [value])

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus()
  }, [focusSignal])

  const parsed = Number(text.replace(/\s/g, '').replace(',', '.')) || 0
  const over = parsed > room
  const hasSomething = presets.length > 0 || parsed > 0
  const showFooter = parsed > 0 || presetPicked

  const commit = () => {
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <Popover open={open && !typing && hasSomething} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative -mr-[7px] ml-auto w-full max-w-[6.5rem]">
          <input
            ref={inputRef}
            disabled={disabled}
            inputMode="decimal"
            value={text}
            placeholder={formatAmount(placeholder)}
            onFocus={() => {
              setTyping(false)
              setOpen(true)
            }}
            onChange={(e) => {
              setTyping(true)
              setPresetPicked(false)
              setText(e.target.value.replace(/[^\d\s,.]/g, ''))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit()
                inputRef.current?.blur()
                setOpen(false)
              }
              if (e.key === 'Escape') {
                setText(value ? formatAmount(value) : '')
                setOpen(false)
              }
            }}
            onBlur={commit}
            aria-label="Сума"
            data-testid={`amount-${draftId}`}
            data-main-action={mainAction ? 'intake' : undefined}
            data-remaining={parsed === 0 ? 'amount-placeholder' : undefined}
            className={cn(
              'h-8 w-full rounded-md border bg-card pl-2 pr-5 text-right text-body font-medium tabular-nums outline-none transition-colors placeholder:font-normal placeholder:text-subtle',
              value > 0 ? 'border-transparent hover:border-border-strong focus:border-fg/50' : 'border-border-strong focus:border-fg/50',
              over && 'text-danger-fg',
            )}
          />
          <span className="pointer-events-none absolute inset-y-0 right-1.5 grid place-items-center text-body text-muted-fg">₴</span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-56 p-1.5 shadow-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target instanceof Node && inputRef.current?.parentElement?.contains(e.target)) e.preventDefault()
        }}
        data-popover-id="amount"
        data-testid="amount-presets"
      >
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText(formatAmount(p.amount))
              setPresetPicked(true)
              onPreset(p)
            }}
            data-testid={`preset-${p.key}`}
            className="flex w-full items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-body hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="text-fg">{p.label}</span>
            <span className="text-label tabular-nums text-muted-fg">{formatMoney(p.amount)}</span>
          </button>
        ))}
        {showFooter && (
          <div className={cn('flex items-center gap-2 px-2 py-1.5', presets.length > 0 && 'mt-1 border-t border-border')}>
            <span className={cn('flex-1 text-label', over ? 'text-danger-fg' : 'text-muted-fg')} data-remaining={over ? undefined : 'amount-after'}>
              {over ? `перебір на ${formatMoney(parsed - room)}` : `лишиться прийняти ${formatMoney(Math.max(0, room - parsed))}`}
            </span>
            {presetPicked && (
              <button
                type="button"
                aria-label="Готово"
                onClick={() => {
                  setOpen(false)
                  inputRef.current?.blur()
                }}
                className="grid size-5 place-items-center rounded-sm bg-fg text-primary-fg"
              >
                <Check className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
