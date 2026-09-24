import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SCENES, SCENE_BY_ID } from './scenes'
import { RAIL_VARIANTS, STEP_VARIANTS, type Role } from './variants'
import { useRentStore } from '@/state/rent-store'
import type { RentId } from '@/mock/rents'
import { RENT_STAGES } from '@/features/rent/stages'
import type { RentStageKey } from '@/mock/types'

/**
 * Стан перегляду: варіант кроку, варіант сайдбару, сцена, контрагент, роль.
 *
 * Живе НАД компоновкою, тому перемикання показу нічого не скидає в даних.
 * Дзеркалиться в URL і localStorage; URL важливіший, бо посилання, кинуте в
 * чат, має відкрити рівно той кадр, який бачив відправник.
 */
interface ViewState {
  sceneId: string
  rentId: RentId
  stage: RentStageKey
  step: string
  rail: string
  role: Role
}

interface LabState extends ViewState {
  setScene: (sceneId: string) => void
  setRent: (rentId: RentId) => void
  setStage: (stage: RentStageKey) => void
  setStep: (code: string) => void
  setRail: (code: string) => void
  setRole: (role: Role) => void
  hidden: boolean
  setHidden: (v: boolean) => void
}

const LabContext = createContext<LabState | null>(null)

const STORAGE_KEY = 'bp-intake.lab'

const isStep = (v: string | null): v is string => !!v && STEP_VARIANTS.some((x) => x.code === v)
const isRail = (v: string | null): v is string => !!v && RAIL_VARIANTS.some((x) => x.code === v)

/** URL — чужий ввід: невідомі значення мовчки відкидаються, а не ламають кадр. */
function readUrl(): Partial<ViewState> & { hidden?: boolean } {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  const out: Partial<ViewState> & { hidden?: boolean } = {}
  const scene = q.get('scene')
  if (scene && SCENE_BY_ID.has(scene)) out.sceneId = scene
  const rent = q.get('party')
  if (rent === 'fl' || rent === 'ul') out.rentId = rent
  const stage = q.get('stage')
  if (stage && RENT_STAGES.some((s) => s.key === stage)) out.stage = stage as RentStageKey
  const step = q.get('v')
  if (isStep(step)) out.step = step
  const rail = q.get('rail')
  if (isRail(rail)) out.rail = rail
  const role = q.get('role')
  if (role === 'manager' || role === 'head') out.role = role
  if (q.get('lab') === 'off') out.hidden = true
  return out
}

function readStorage(): Partial<ViewState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function LabProvider({ children }: { children: ReactNode }) {
  const url = readUrl()
  const stored = readStorage()
  const seedScene = SCENE_BY_ID.get(url.sceneId ?? stored.sceneId ?? '') ?? SCENES[0]
  /**
   * Сцена в URL перебиває збережене: посилання `?scene=split` має відкритись
   * саме на поділі, а не на тому контрагенті, де людина була минулого разу.
   * Явні `party` і `stage` в URL мають пріоритет над сценою.
   */
  const sceneFromUrl = url.sceneId != null
  const [view, setView] = useState<ViewState>({
    sceneId: seedScene.id,
    rentId: url.rentId ?? (sceneFromUrl ? seedScene.rent : stored.rentId) ?? seedScene.rent,
    stage: url.stage ?? (sceneFromUrl ? seedScene.stage : stored.stage) ?? seedScene.stage,
    step: url.step ?? (isStep(stored.step ?? null) ? stored.step! : '0'),
    rail: url.rail ?? (isRail(stored.rail ?? null) ? stored.rail! : '0'),
    role: url.role ?? stored.role ?? 'manager',
  })
  const [hidden, setHidden] = useState(Boolean(url.hidden))

  const { dispatch } = useRentStore()

  useEffect(() => {
    const s = SCENE_BY_ID.get(view.sceneId)
    if (!s) return
    dispatch({ type: 'APPLY_SCENE', actions: s.setup(view.rentId) })
  }, [view.sceneId, view.rentId, dispatch])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    q.set('v', view.step)
    q.set('rail', view.rail)
    q.set('scene', view.sceneId)
    q.set('party', view.rentId)
    q.set('stage', view.stage)
    q.set('role', view.role)
    if (hidden) q.set('lab', 'off')
    else q.delete('lab')
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view))
    } catch {
      /* сховище недоступне — посилання все одно працює */
    }
  }, [view, hidden])

  // Ctrl+. ховає віджет цілком: у кадри для бізнесу він не потрапляє.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault()
        setHidden((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setScene = useCallback((sceneId: string) => {
    const s = SCENE_BY_ID.get(sceneId)
    if (!s) return
    setView((v) => ({ ...v, sceneId, rentId: s.rent, stage: s.stage }))
  }, [])

  const setStage = useCallback((stage: RentStageKey) => {
    setView((v) => ({ ...v, stage }))
  }, [])

  const value = useMemo<LabState>(
    () => ({
      ...view,
      setScene,
      setRent: (rentId) => setView((v) => ({ ...v, rentId })),
      setStage,
      setStep: (step) => setView((v) => ({ ...v, step })),
      setRail: (rail) => setView((v) => ({ ...v, rail })),
      setRole: (role) => setView((v) => ({ ...v, role })),
      hidden,
      setHidden,
    }),
    [view, setScene, setStage, hidden],
  )

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab(): LabState {
  const ctx = useContext(LabContext)
  if (!ctx) throw new Error('useLab must be used inside LabProvider')
  return ctx
}
