import { RentCard } from '@/features/rent/RentCard'
import { RentStoreProvider, useRentStore } from '@/state/rent-store'
import { LabProvider, useLab } from '@/lab/lab-state'
import { LabWidget } from '@/lab/LabWidget'

/**
 * Одна адреса, один екран: картка оренди на кроці «Оплата». Варіант, сцена,
 * контрагент і роль живуть у query-рядку, тож роутер не потрібен.
 */
export default function App() {
  return (
    <RentStoreProvider>
      <LabProvider>
        <Shell />
      </LabProvider>
    </RentStoreProvider>
  )
}

function Shell() {
  const { rentId } = useLab()
  const { rents } = useRentStore()
  const rent = rents[rentId]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-shell">
      <main className="min-h-0 flex-1">
        <RentCard key={rentId} rent={rent} />
      </main>
      <LabWidget />
    </div>
  )
}
