import { useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CASHBOXES, MANAGER, shortIban } from '@/mock/cashboxes'
import type { Cashbox, MethodKind, Party } from '@/mock/types'
import { MethodTile } from '../method-meta'

/**
 * Список кас / рахунків отримувача. Порт `DestinationPicker` з CRM: групи
 * «Розрахунковий рахунок юрособи» → «Мої каси» → «Відділення оренди» →
 * «Інші каси», пошук від шести записів, лічильник, прокрутка 224 px.
 *
 * Список не фільтрується (у CRM можна прийняти в будь-яку касу), групи лише
 * впорядковують. Висота фіксована: пошук не змінює розмір поповера.
 */

interface Group {
  key: string
  title: string
  tone: string
  items: Cashbox[]
}

export function optionsFor(method: MethodKind, party: Party): Cashbox[] {
  if (method === 'cash') return CASHBOXES.filter((c) => c.kind === 'cash')
  if (method === 'terminal') return CASHBOXES.filter((c) => c.kind === 'terminal')
  if (method === 'bank')
    return CASHBOXES.filter((c) => c.kind === 'bank' && (party === 'ul' || !c.orgAccount))
  return []
}

/**
 * Каса за замовчуванням (правило PAY-28 CRM): розрахунковий рахунок юрособи
 * для переказу юрособи; своя готівкова каса у відділенні профілю; будь-яка
 * каса відділення. Каса іншого відділення не підставляється ніколи.
 */
export function defaultCashbox(method: MethodKind, party: Party, branch: string): string | null {
  const opts = optionsFor(method, party)
  if (method === 'bank' && party === 'ul') return opts.find((c) => c.orgAccount)?.id ?? null
  const own = opts.find((c) => c.ownerId === MANAGER.id && c.branch === branch)
  if (own) return own.id
  const local = opts.find((c) => c.branch === branch)
  return local?.id ?? null
}

function groupsOf(opts: Cashbox[], branch: string): Group[] {
  const groups: Group[] = [
    { key: 'org', title: 'Розрахунковий рахунок юрособи', tone: 'bg-accent-soft text-accent-fg', items: [] },
    { key: 'mine', title: 'Мої каси', tone: 'bg-success-soft text-success-fg', items: [] },
    { key: 'branch', title: 'Відділення оренди', tone: 'bg-accent-soft text-accent-fg', items: [] },
    { key: 'other', title: 'Інші каси', tone: 'bg-muted text-muted-fg', items: [] },
  ]
  for (const c of opts) {
    if (c.orgAccount) groups[0].items.push(c)
    else if (c.ownerId === MANAGER.id) groups[1].items.push(c)
    else if (c.branch === branch) groups[2].items.push(c)
    else groups[3].items.push(c)
  }
  const out = groups.filter((g) => g.items.length > 0)
  if (out.length === 1 && out[0].key === 'other') out[0].title = 'Каси'
  return out
}

export function CashboxList({
  method,
  party,
  branch,
  value,
  onPick,
  autoFocus,
  className,
}: {
  method: MethodKind
  party: Party
  branch: string
  value: string | null
  onPick: (id: string) => void
  autoFocus?: boolean
  className?: string
}) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const opts = useMemo(() => optionsFor(method, party), [method, party])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return opts
    return opts.filter((c) =>
      [c.name, c.org, c.branch ?? '', c.iban].some((f) => f.toLowerCase().includes(needle)),
    )
  }, [opts, q])
  const groups = groupsOf(filtered, branch)
  const searchable = opts.length >= 6

  return (
    <div className={cn('overflow-hidden rounded-md border border-border', className)} data-testid="cashbox-list">
      {searchable && (
        <label className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
          <input
            ref={inputRef}
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Каса, відділення, рахунок…"
            aria-label="Пошук каси"
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-subtle"
            data-testid="cashbox-search"
          />
          <span className="shrink-0 text-label tabular-nums text-subtle">{filtered.length}</span>
        </label>
      )}
      <div className="h-56 overflow-y-auto" role="listbox" aria-label="Каси">
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-body text-muted-fg">Нічого не знайдено</p>
        )}
        {groups.map((g) => (
          <div key={g.key} role="group" aria-label={g.title}>
            <div className={cn('sticky top-0 z-[1] px-2.5 py-1 text-mono font-semibold uppercase tracking-[0.04em]', g.tone)}>
              {g.title}
            </div>
            {g.items.map((c) => {
              const active = c.id === value
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onPick(c.id)}
                  data-testid={`cashbox-option-${c.id}`}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                    active && 'bg-muted/60',
                  )}
                >
                  <MethodTile method={method} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-fg">{c.name}</span>
                    <span className="block truncate text-label text-muted-fg">{c.org}</span>
                  </span>
                  <span className="shrink-0 font-mono text-mono text-subtle">{shortIban(c.iban)}</span>
                  <Check className={cn('size-3.5 shrink-0', active ? 'text-fg' : 'invisible')} aria-hidden />
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
