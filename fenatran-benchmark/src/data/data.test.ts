import { beforeEach, describe, expect, it } from 'vitest'
import { FEATURES, QUESTIONNAIRE_VERSION } from '../config/questionnaire'
import Dexie from 'dexie'
import { BenchmarkDb, db } from './db'
import { evaluationRepository } from './repositories/evaluation'
import { mediaRepository } from './repositories/media'
import { profileRepository } from './repositories/profile'
import {
  emailSchema,
  evaluationSchema,
  featureAnswerSchema,
  mediaSchema,
  profileSchema,
} from './schemas'
import type { Media, Profile } from './types'

const profile: Profile = { name: 'Ana Silva', email: 'ana@example.com' }

const makeMedia = (id: string, evaluationId: string, createdAt: string, size = 3): Media => ({
  id,
  evaluationId,
  role: 'component',
  type: 'photo',
  mime: 'image/jpeg',
  // fake-indexeddb clones Blobs into empty objects, so keep a size-bearing stand-in
  blob: { size } as Blob,
  caption: '',
  createdAt,
})

beforeEach(async () => {
  await Promise.all([db.profile.clear(), db.evaluations.clear(), db.media.clear()])
})

describe('questionnaire config', () => {
  it('has unique feature ids and a version', () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length)
    expect(FEATURES).toHaveLength(13)
    expect(QUESTIONNAIRE_VERSION).toBeTruthy()
  })
})

describe('profileRepository', () => {
  it('returns undefined when empty, then the saved profile without the key', async () => {
    expect(await profileRepository.get()).toBeUndefined()
    await profileRepository.save(profile)
    await profileRepository.save({ ...profile, name: 'Ana B' })
    expect(await profileRepository.get()).toEqual({ ...profile, name: 'Ana B' })
    expect(await db.profile.count()).toBe(1)
  })
})

describe('database upgrade', () => {
  it('keeps only name and e-mail of a v1 profile', async () => {
    const name = 'upgrade-test'
    const old = new Dexie(name)
    old
      .version(1)
      .stores({ profile: 'id', evaluations: 'id, status, updatedAt', media: 'id, evaluationId' })
    await old.table('profile').put({
      id: 'profile',
      name: 'Ana',
      email: 'ana@example.com',
      role: 'Manager',
      area: 'Chassis',
      privacyAcceptedAt: '2026-10-19T10:00:00.000Z',
      privacyVersion: '2026.1',
    })
    old.close()
    const upgraded = new BenchmarkDb(name)
    expect(await upgraded.profile.get('profile')).toEqual({
      id: 'profile',
      name: 'Ana',
      email: 'ana@example.com',
    })
    upgraded.close()
    await Dexie.delete(name)
  })
})

describe('evaluationRepository', () => {
  it('creates truck and component drafts', async () => {
    const truck = await evaluationRepository.create('truck')
    const component = await evaluationRepository.create('component')
    expect(truck).toMatchObject({ kind: 'truck', status: 'draft' })
    expect(truck.truck?.features).toEqual({})
    expect(component.component?.name).toBe('')
    expect(evaluationSchema.safeParse(truck).success).toBe(true)
    expect(evaluationSchema.safeParse(component).success).toBe(true)
    expect(await evaluationRepository.get(truck.id)).toEqual(truck)
  })

  it('saves, lists newest first and finalizes', async () => {
    const a = await evaluationRepository.create('truck')
    const b = await evaluationRepository.create('component')
    await new Promise((resolve) => setTimeout(resolve, 5))
    const saved = await evaluationRepository.save(a)
    expect(saved.updatedAt > a.updatedAt).toBe(true)
    expect((await evaluationRepository.list()).map((e) => e.id)).toEqual([a.id, b.id])
    await evaluationRepository.finalize(b.id)
    const finalized = await evaluationRepository.get(b.id)
    expect(finalized).toMatchObject({ status: 'finalized' })
    expect(finalized?.finalizedAt).toBeDefined()
  })

  it('removes an evaluation together with its media only', async () => {
    const a = await evaluationRepository.create('truck')
    const b = await evaluationRepository.create('truck')
    await mediaRepository.add(makeMedia('m1', a.id, '2026-01-01T00:00:00.000Z'))
    await mediaRepository.add(makeMedia('m2', b.id, '2026-01-01T00:00:00.000Z'))
    await evaluationRepository.remove(a.id)
    expect(await evaluationRepository.get(a.id)).toBeUndefined()
    expect(await mediaRepository.get('m1')).toBeUndefined()
    expect(await mediaRepository.get('m2')).toBeDefined()
  })
})

describe('mediaRepository', () => {
  it('adds, lists by evaluation in creation order, updates and removes', async () => {
    await mediaRepository.add(makeMedia('late', 'e1', '2026-01-02T00:00:00.000Z'))
    await mediaRepository.add(makeMedia('early', 'e1', '2026-01-01T00:00:00.000Z'))
    await mediaRepository.add(makeMedia('other', 'e2', '2026-01-01T00:00:00.000Z'))
    expect((await mediaRepository.listByEvaluation('e1')).map((m) => m.id)).toEqual([
      'early',
      'late',
    ])
    await mediaRepository.update('early', { caption: 'door gap' })
    expect((await mediaRepository.get('early'))?.caption).toBe('door gap')
    await mediaRepository.remove('late')
    expect(await mediaRepository.get('late')).toBeUndefined()
    await mediaRepository.removeByEvaluation('e1')
    expect(await mediaRepository.listByEvaluation('e1')).toEqual([])
    expect(await mediaRepository.get('other')).toBeDefined()
  })

  it('sums stored bytes', async () => {
    expect(await mediaRepository.totalBytes()).toBe(0)
    await mediaRepository.add(makeMedia('a', 'e1', '2026-01-01T00:00:00.000Z', 3))
    await mediaRepository.add(makeMedia('b', 'e1', '2026-01-01T00:00:00.000Z', 4))
    expect(await mediaRepository.totalBytes()).toBe(7)
  })
})

describe('schemas', () => {
  it('normalizes and validates e-mail', () => {
    expect(emailSchema.parse('  Ana@Example.COM ')).toBe('ana@example.com')
    expect(emailSchema.safeParse('').success).toBe(false)
    expect(emailSchema.safeParse('ana@').success).toBe(false)
    expect(emailSchema.safeParse('a@@b.com').success).toBe(false)
  })

  it('validates profile and score values', () => {
    expect(profileSchema.safeParse(profile).success).toBe(true)
    expect(featureAnswerSchema.safeParse({ score: 0, comment: '', mediaIds: [] }).success).toBe(
      true,
    )
    expect(featureAnswerSchema.safeParse({ score: null, comment: '', mediaIds: [] }).success).toBe(
      true,
    )
    expect(featureAnswerSchema.safeParse({ score: 6, comment: '', mediaIds: [] }).success).toBe(
      false,
    )
  })

  it('validates media', () => {
    expect(
      mediaSchema.safeParse({
        ...makeMedia('m', 'e', '2026-01-01T00:00:00.000Z'),
        blob: new Blob(['x']),
      }).success,
    ).toBe(true)
    expect(mediaSchema.safeParse({ id: 'm' }).success).toBe(false)
  })

  it('accepts an empty name but not a long one, and requires the e-mail', () => {
    expect(profileSchema.parse({ name: '  ', email: 'Jose.Conceicao@Empresa.com.br' })).toEqual({
      name: '',
      email: 'jose.conceicao@empresa.com.br',
    })
    expect(profileSchema.parse({ name: ' José Ção ', email: 'a@b.co' }).name).toBe('José Ção')
    const result = profileSchema.safeParse({ name: 'x'.repeat(81), email: '' })
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['name', 'email'])
  })
})
