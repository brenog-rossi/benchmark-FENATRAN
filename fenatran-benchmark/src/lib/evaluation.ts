import { OTHER } from '../config/questionnaire'
import type { Evaluation } from '../data/types'

export function brandLabel(brand: string, brandOther?: string): string {
  return brand === OTHER ? (brandOther ?? '').trim() : brand
}

export function evaluationTitle(evaluation: Evaluation): string {
  if (evaluation.kind === 'truck') {
    const truck = evaluation.truck
    const title = [brandLabel(truck?.brand ?? '', truck?.brandOther), truck?.model.trim()]
      .filter(Boolean)
      .join(' ')
    return title || 'Untitled truck'
  }
  return evaluation.component?.name.trim() || 'Untitled component'
}

export function scoredCount(evaluation: Evaluation): number {
  return Object.values(evaluation.truck?.features ?? {}).filter((f) => f.score !== null).length
}
