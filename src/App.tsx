import { RentCard } from '@/features/rent/RentCard'
import { StoreProvider } from '@/state/store'
import { LabProvider, useLab } from '@/lab/lab-state'
import { LabWidget } from '@/lab/LabWidget'
import { buildRent, type SceneId } from '@/mock/rents'

/**
 * Одна адреса, один екран: картка оренди на кроці «Оплата». Варіант, сцена,
 * контрагент і роль живуть у query-рядку, тож роутер не потрібен.
 *
 * Стор перезбирається з нуля (`key`), коли міняється сцена, контрагент або
 * варіант кроку: варіанти порівнюються з однієї точки.
 */
export default function App() {
  return (
    <LabProvider>
      <Shell />
    </LabProvider>
  )
}

function Shell() {
  const { resetKey, sceneId, party } = useLab()
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-shell">
      <StoreProvider key={resetKey} initial={buildRent(sceneId as SceneId, party)}>
        <main className="min-h-0 flex-1">
          <RentCard />
        </main>
      </StoreProvider>
      <LabWidget />
    </div>
  )
}
