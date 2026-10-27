import { create } from 'zustand'
import { evaluationRepository } from '../data/repositories/evaluation'
import type { Evaluation } from '../data/types'

// Shared list for the home pane; reload after any write. undefined = loading.
type EvaluationsState = {
  items: Evaluation[] | undefined
  failed: boolean
  load: () => Promise<void>
}

export const useEvaluations = create<EvaluationsState>((set) => ({
  items: undefined,
  failed: false,
  load: async () => {
    try {
      set({ items: await evaluationRepository.list(), failed: false })
    } catch {
      set({ failed: true })
    }
  },
}))
