import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { evaluationRepository } from '../data/repositories/evaluation'
import { useEvaluations } from './useEvaluations'

beforeEach(async () => {
  await db.evaluations.clear()
  useEvaluations.setState({ items: undefined })
})

describe('useEvaluations', () => {
  it('starts loading and loads the stored evaluations', async () => {
    expect(useEvaluations.getState().items).toBeUndefined()
    await useEvaluations.getState().load()
    expect(useEvaluations.getState().items).toEqual([])

    const created = await evaluationRepository.create('component')
    await useEvaluations.getState().load()
    expect(useEvaluations.getState().items?.map((e) => e.id)).toEqual([created.id])
  })
})
