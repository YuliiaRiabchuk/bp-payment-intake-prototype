import type { ComponentType } from 'react'
import { StepV0 } from './v0/StepV0'
import { RailV0 } from './v0/RailV0'

/**
 * Реєстр варіантів: код з віджета → компонент. Крок і сайдбар незалежні.
 * Варіант 0 — порт чинного проду, антиреференс і база вимірів.
 */
export const STEPS: Record<string, ComponentType> = {
  '0': StepV0,
}

export const RAILS: Record<string, ComponentType> = {
  '0': RailV0,
}
