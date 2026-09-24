import type { ReactNode } from 'react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { cashboxOf, shortIban } from '@/mock/cashboxes'
import { walletAvailable, type Balance } from '@/domain/money'
import { useStore } from '@/state/store'
import { METHOD_META, MethodTile } from '@/features/rent/method-meta'
import { CashboxList, defaultCashbox } from '@/features/rent/shared/CashboxList'
import type { Draft, MethodKind } from '@/mock/types'

/**
 * Варіант 0 — поповер-майстер «Чим платить» (кадри 2–4).
 *
 * Той самий поповер міняє зміст і розмір: радіо способів → пошук каси з
 * 49 записів → підсумок з двома «Змінити». У коді CRM у нього 11 різних
 * станів. Порт відтворює ті, що трапляються в сценах: порожній список,
 * підсумок, повторно відкритий спосіб, повторно відкрита каса, список без
 * каси за замовчуванням і блок «Зарахувати» юрособи.
 */

export function methodsFor(party: 'fl' | 'ul', wallet: number): MethodKind[] {
  const base: MethodKind[] = party === 'fl' ? ['cash', 'terminal', 'bank'] : ['bank', 'cash', 'terminal']
  if (party === 'fl' && wallet > 0) base.push('balance')
  return base
}

export function SetupPopoverV0({
  draft,
  bal,
  open,
  onOpenChange,
  onDone,
  trigger,
}: {
  draft: Draft
  bal: Balance
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
  trigger: ReactNode
}) {
  const { rent, dispatch } = useStore()
  const [editMethod, setEditMethod] = useState(false)
  const [editDest, setEditDest] = useState(false)
  const meta = draft.method ? METHOD_META[draft.method] : null
  const needsDest = !!meta?.destLabel
  const configured = !!draft.method && (!needsDest || !!draft.cashboxId)
  const ul = rent.party === 'ul'
  const box = cashboxOf(draft.cashboxId)

  const pick = (m: MethodKind) => {
    dispatch({
      type: 'DRAFT_PATCH',
      id: draft.id,
      patch: {
        method: m,
        cashboxId: m === 'balance' ? null : defaultCashbox(m, rent.party, rent.branch),
        amount: m === 'balance' ? Math.min(draft.amount || 0, walletAvailable(rent)) : draft.amount,
      },
    })
    setEditMethod(false)
    setEditDest(false)
  }

  const listMethods = !draft.method || editMethod

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          setEditMethod(false)
          setEditDest(false)
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[400px] p-4 shadow-dialog"
        data-popover-id="method-setup"
        data-testid="method-setup"
      >
        <div className="flex flex-col gap-3">
          <section className="flex flex-col gap-1.5">
            <span className="text-label text-muted-fg">Чим платить</span>
            {listMethods ? (
              <div role="radiogroup" aria-label="Чим платить" className="flex flex-col gap-1.5">
                {methodsFor(rent.party, rent.counterparty.wallet).map((m) => {
                  const active = draft.method === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pick(m)}
                      data-testid={`method-radio-${m}`}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border px-2.5 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg',
                        active ? 'border-fg/50 ring-1 ring-fg/50' : 'border-border',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-4 place-items-center rounded-full border',
                          active ? 'border-fg' : 'border-border-strong',
                        )}
                        aria-hidden
                      >
                        {active && <span className="size-2 rounded-full bg-fg" />}
                      </span>
                      <MethodTile method={m} size="sm" />
                      <span className="text-body text-fg">{METHOD_META[m].label}</span>
                      {m === 'balance' && (
                        <span className="ml-auto text-label tabular-nums text-muted-fg">
                          {formatMoney(walletAvailable(rent))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <Summary onChange={() => setEditMethod(true)} testId="setup-change-method">
                <MethodTile method={draft.method!} size="sm" />
                <span className="text-body text-fg">{meta!.label}</span>
              </Summary>
            )}
          </section>

          {ul && draft.method && (
            <section className="flex flex-col gap-1.5">
              <span className="text-label text-muted-fg">Зарахувати</span>
              <SegmentedControl
                fullWidth
                size="sm"
                value={draft.target === 'deposit' ? 'deposit' : 'rent'}
                onChange={(t) => dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { target: t } })}
                options={[
                  { value: 'rent', label: `Оренда ${formatMoney(bal.rentAccount.remaining)}` },
                  { value: 'deposit', label: `Застава ${formatMoney(bal.deposit.remaining)}` },
                ]}
              />
            </section>
          )}

          {draft.method && needsDest && (
            <section className="flex flex-col gap-1.5">
              <span className="text-label text-muted-fg">{meta!.destLabel}</span>
              {box && !editDest ? (
                <Summary onChange={() => setEditDest(true)} testId="setup-change-dest">
                  <MethodTile method={draft.method} size="sm" />
                  <span className="min-w-0 truncate text-body text-fg">
                    {box.name}
                    <span className="text-muted-fg"> — {shortIban(box.iban)}</span>
                  </span>
                </Summary>
              ) : (
                <CashboxList
                  method={draft.method}
                  party={rent.party}
                  branch={rent.branch}
                  value={draft.cashboxId}
                  autoFocus
                  onPick={(id) => {
                    dispatch({ type: 'DRAFT_PATCH', id: draft.id, patch: { cashboxId: id } })
                    setEditDest(false)
                  }}
                />
              )}
            </section>
          )}

          <Button
            className="w-full"
            disabled={!configured}
            onClick={onDone}
            data-testid="setup-done"
            data-main-action={configured ? 'intake' : undefined}
          >
            Готово
          </Button>
          {draft.method && !configured && <p className="-mt-1.5 text-label text-muted-fg">Спочатку оберіть касу</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Summary({ children, onChange, testId }: { children: ReactNode; onChange: () => void; testId: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
      {children}
      <button
        type="button"
        onClick={onChange}
        data-testid={testId}
        className="ml-auto shrink-0 text-label text-fg-2 underline underline-offset-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
      >
        Змінити
      </button>
    </div>
  )
}
