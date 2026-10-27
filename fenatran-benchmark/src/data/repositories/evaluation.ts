import { newId, nowIso } from '../../lib/ids'
import { db } from '../db'
import type { Evaluation } from '../types'

export const evaluationRepository = {
  async create(kind: Evaluation['kind']): Promise<Evaluation> {
    const now = nowIso()
    const evaluation: Evaluation = {
      id: newId(),
      kind,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ...(kind === 'truck'
        ? { truck: { brand: '', model: '', brochureMediaIds: [], features: {} } }
        : { component: { name: '', manufacturer: '', mediaIds: [], comments: '' } }),
    }
    await db.evaluations.add(evaluation)
    return evaluation
  },

  get(id: string): Promise<Evaluation | undefined> {
    return db.evaluations.get(id)
  },

  async list(): Promise<Evaluation[]> {
    return db.evaluations.orderBy('updatedAt').reverse().toArray()
  },

  // Autosave entry point: always refreshes updatedAt.
  async save(evaluation: Evaluation): Promise<Evaluation> {
    const saved = { ...evaluation, updatedAt: nowIso() }
    await db.evaluations.put(saved)
    return saved
  },

  async finalize(id: string): Promise<void> {
    const now = nowIso()
    await db.evaluations.update(id, { status: 'finalized', finalizedAt: now, updatedAt: now })
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.evaluations, db.media, async () => {
      await db.media.where('evaluationId').equals(id).delete()
      await db.evaluations.delete(id)
    })
  },

  // Wipe after export: all evaluations and media (the profile is kept).
  async removeAll(): Promise<void> {
    await db.transaction('rw', db.evaluations, db.media, async () => {
      await db.media.clear()
      await db.evaluations.clear()
    })
  },
}
