import type { ComponentType } from 'react'
import { StepV0 } from './v0/StepV0'
import { RailV0 } from './v0/RailV0'
import { StepA } from './a/StepA'
import { StepB } from './b/StepB'
import { StepC } from './c/StepC'
import { StepD } from './d/StepD'

/**
 * Реєстр варіантів: код з віджета → компонент. Крок і сайдбар незалежні.
 * Варіант 0 — порт чинного проду, антиреференс і база вимірів.
 */
export const STEPS: Record<string, ComponentType> = {
  '0': StepV0,
  A: StepA,
  B: StepB,
  C: StepC,
  D: StepD,
}

export const RAILS: Record<string, ComponentType> = {
  '0': RailV0,
}
