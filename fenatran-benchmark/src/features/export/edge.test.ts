import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { evaluationRepository } from '../../data/repositories/evaluation'
import { profileRepository } from '../../data/repositories/profile'
import { emailSchema } from '../../data/schemas'
import { maskEmail } from '../../lib/emailMask'
import {
  componentEvaluation,
  exportSource,
  mediaItem,
  profileWith,
  sourceWith,
  truckEvaluation,
  videoItem,
} from '../../test/factories/export'
import { buildDataJson, type DataJson } from './builders/json'
import { buildMarkdown } from './builders/markdown'
import { prepareMedia } from './builders/model'
import { buildExport, loadExportSource, zipName } from './exporter'
import { canShareFiles, shareFiles } from './share'

vi.mock('../../lib/image', () => ({ resizeImage: (blob: Blob) => Promise.resolve(blob) }))

const RESERVE = 2 * 1024 * 1024
const NOW = new Date(2026, 9, 19, 12)

async function unzip(file: File) {
  return unzipSync(new Uint8Array(await file.arrayBuffer()))
}

async function parts(source = exportSource(), limit?: number, split = true) {
  const files = await prepareMedia(source)
  const result = await buildExport(source, files, { includeVideos: true, split, limit }, NOW)
  return { files, result }
}

describe('empty and "Other" evaluations', () => {
  it('exports a device without evaluations as one valid part', async () => {
    const { result } = await parts(sourceWith())
    expect(result.zips).toHaveLength(1)
    const entries = await unzip(result.zips[0]!)
    expect(Object.keys(entries).sort()).toEqual([
      'README.txt',
      'data.json',
      'gallery.json',
      'summary.md',
      'summary.xlsx',
    ])
    expect((JSON.parse(strFromU8(entries['data.json']!)) as DataJson).evaluations).toEqual([])
  })

  it('titles blank trucks, blank components and Other brands without crashing', () => {
    const blankTruck = truckEvaluation({
      truck: { brand: '', model: '  ', brochureMediaIds: [], features: {} },
    })
    const otherNoText = truckEvaluation({
      id: 't2',
      truck: { brand: 'Other', model: '', brochureMediaIds: [], features: {} },
    })
    const blankComponent = componentEvaluation({
      component: { name: ' ', manufacturer: '', mediaIds: [], comments: '' },
    })
    const source = sourceWith({
      evaluations: [blankTruck, otherNoText, blankComponent],
      profile: profileWith({ name: '' }),
    })
    const json = buildDataJson({
      source,
      files: [],
      partOf: new Map(),
      part: 1,
      totalParts: 1,
      videosIncluded: true,
      exportId: 'e',
      exportedAt: NOW.toISOString(),
    })
    expect(json.evaluations.map((e) => e.title)).toEqual([
      'Untitled truck',
      'Untitled truck',
      'Untitled component',
    ])
    expect(json.evaluator).toEqual({ name: '', email: 'joao.silva@example.com' })
  })
})

describe('special characters', () => {
  it('keeps ZIP names and media paths ASCII-safe', async () => {
    const source = sourceWith({
      profile: profileWith({ name: 'José "Zé" D\'Ávila / Ñandú' }),
      evaluations: [
        truckEvaluation({
          truck: {
            brand: 'Other',
            brandOther: 'Citroën Ação',
            model: 'C/D:1*?',
            brochureMediaIds: [],
            features: {},
          },
        }),
      ],
      media: [
        mediaItem({
          id: 'a',
          evaluationId: 'truck-1',
          caption: 'Câmbio <ruim> | "quebra" \\ 100%',
        }),
        mediaItem({ id: 'b', evaluationId: 'truck-1', caption: '***' }),
      ],
    })
    const { files, result } = await parts(source)
    for (const file of files) {
      expect(file.path).toMatch(/^media\/01_[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/)
    }
    expect(files[0]!.path).toContain('_Cambio-ruim-quebra-100')
    expect(files[1]!.path).toMatch(/feature_general_02\.png$/)
    expect(result.zips[0]!.name).toBe('FENATRAN2026_Jose_Ze_D_Avila_Nandu_2026-10-19.zip')
    const markdown = buildMarkdown({
      source,
      files,
      partOf: new Map(),
      part: 1,
      totalParts: 1,
      videosIncluded: true,
      exportId: 'e',
      exportedAt: NOW.toISOString(),
    })
    expect(markdown).toContain('Citroën Ação')
  })

  it('falls back to a generic evaluator name when nothing is usable', () => {
    expect(zipName('***', NOW)).toBe('FENATRAN2026_Evaluator_2026-10-19.zip')
  })
})

describe('scores', () => {
  it('keeps 0 distinct from not scored in JSON and Markdown', async () => {
    const source = exportSource()
    const json = buildDataJson({
      source,
      files: [],
      partOf: new Map(),
      part: 1,
      totalParts: 1,
      videosIncluded: true,
      exportId: 'e',
      exportedAt: NOW.toISOString(),
    })
    const features = json.evaluations[0]!.truck!.features
    expect(features.bed!.score).toBe(0)
    expect(features['cab-space']!.score).toBeNull()
    const markdown = buildMarkdown({
      source,
      files: [],
      partOf: new Map(),
      part: 1,
      totalParts: 1,
      videosIncluded: true,
      exportId: 'e',
      exportedAt: NOW.toISOString(),
    })
    expect(markdown).toMatch(/\| Bed[^|]*\| 0 \|/)
    expect(markdown).toMatch(/\| Cab space[^|]*\| - \|/)
    expect(markdown).toContain('Features scored: 2 of')
  })
})

describe('huge media sets', () => {
  const evaluation = truckEvaluation()
  const limit = RESERVE + 100

  it('spreads many items over many parts, each with the documents and every item once', async () => {
    const media = Array.from({ length: 12 }, (_, i) => videoItem(`v${i}`, evaluation.id, 40))
    const { result } = await parts(sourceWith({ evaluations: [evaluation], media }), limit)
    expect(result.zips).toHaveLength(6)
    const seen: string[] = []
    for (const [index, zip] of result.zips.entries()) {
      expect(zip.name).toContain(`_part${index + 1}of6.zip`)
      const entries = await unzip(zip)
      expect(Object.keys(entries)).toEqual(expect.arrayContaining(['data.json', 'README.txt']))
      const data = JSON.parse(strFromU8(entries['data.json']!)) as DataJson
      expect(data.part).toBe(index + 1)
      expect(data.totalParts).toBe(6)
      for (const entry of data.evaluations[0]!.media.filter((m) => m.part === index + 1)) {
        expect(entries[entry.file!]).toBeDefined()
        seen.push(entry.id)
      }
    }
    expect(seen.sort()).toEqual(media.map((m) => m.id).sort())
  })

  it('gives a single item over the limit a part of its own', async () => {
    const media = [
      videoItem('big', evaluation.id, 500),
      videoItem('s1', evaluation.id, 30),
      videoItem('s2', evaluation.id, 30),
    ]
    const { result } = await parts(sourceWith({ evaluations: [evaluation], media }), limit)
    expect(result.zips).toHaveLength(2)
    const first = await unzip(result.zips[0]!)
    const mediaInFirst = Object.keys(first).filter((p) => p.startsWith('media/'))
    expect(mediaInFirst).toHaveLength(1)
    expect(first[mediaInFirst[0]!]!.length).toBe(500)
    const second = await unzip(result.zips[1]!)
    expect(Object.keys(second).filter((p) => p.startsWith('media/'))).toHaveLength(2)
    expect(second['data.json']).toBeDefined()
  })

  it('does not split when split is off', async () => {
    const media = [videoItem('a', evaluation.id, 500), videoItem('b', evaluation.id, 500)]
    const { result } = await parts(sourceWith({ evaluations: [evaluation], media }), limit, false)
    expect(result.zips).toHaveLength(1)
  })
})

describe('sharing without APIs', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
  })

  const file = new File(['x'], 'a.zip')

  it('reports no support when navigator.share or canShare are missing or throw', () => {
    expect(canShareFiles([file])).toBe(false)
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() })
    expect(canShareFiles([file])).toBe(false)
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => {
        throw new TypeError('bad')
      },
    })
    expect(canShareFiles([file])).toBe(false)
  })

  it('treats a missing navigator.share as a failed share, not a crash', async () => {
    await expect(shareFiles([file], 'T')).resolves.toBe('failed')
  })

  it('treats quota-like errors as failed and AbortError as cancelled', async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    await expect(shareFiles([file], 'T')).resolves.toBe('failed')
    share.mockRejectedValueOnce(new DOMException('no', 'AbortError'))
    await expect(shareFiles([file], 'T')).resolves.toBe('cancelled')
  })
})

describe('e-mail validation', () => {
  it.each([
    '',
    '   ',
    'joao',
    'joao@',
    '@example.com',
    'joao@example',
    'jo ao@example.com',
    'a@@example.com',
  ])('rejects %j', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false)
  })

  it('normalizes case and surrounding spaces, and the mask drops extra at-signs', () => {
    expect(emailSchema.parse('  Joao.Silva@EXAMPLE.com ')).toBe('joao.silva@example.com')
    expect(maskEmail('A@@b @c')).toBe('a@bc')
  })
})

describe('re-export after editing a finalized evaluation', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await profileRepository.save(profileWith())
  })

  it('keeps the evaluation finalized, refreshes updatedAt and exports the edit with a new id', async () => {
    const created = await evaluationRepository.create('component')
    await evaluationRepository.save({
      ...created,
      component: { name: 'Pump', manufacturer: 'A', mediaIds: [], comments: '' },
    })
    await evaluationRepository.finalize(created.id)
    const before = (await evaluationRepository.get(created.id))!
    expect(before.status).toBe('finalized')

    const first = await buildFrom(await loadExportSource())
    await new Promise((resolve) => setTimeout(resolve, 5))
    await evaluationRepository.save({
      ...before,
      component: { ...before.component!, name: 'Pump Ação' },
    })
    const after = (await evaluationRepository.get(created.id))!
    expect(after.status).toBe('finalized')
    expect(after.finalizedAt).toBe(before.finalizedAt)
    expect(after.updatedAt > before.updatedAt).toBe(true)

    const second = await buildFrom(await loadExportSource())
    expect(second.exportId).not.toBe(first.exportId)
    expect(first.evaluations[0]!.title).toBe('Pump')
    expect(second.evaluations[0]!.title).toBe('Pump Ação')
    expect(second.evaluations).toHaveLength(1)
  })

  it('returns null without a profile', async () => {
    await db.profile.clear()
    await expect(loadExportSource()).resolves.toBeNull()
  })
})

async function buildFrom(source: Awaited<ReturnType<typeof loadExportSource>>) {
  const files = await prepareMedia(source!)
  const result = await buildExport(source!, files, { includeVideos: true, split: false }, NOW)
  const entries = await unzip(result.zips[0]!)
  return JSON.parse(strFromU8(entries['data.json']!)) as DataJson
}
