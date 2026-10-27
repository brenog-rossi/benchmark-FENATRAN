import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { evaluationRepository } from '../../data/repositories/evaluation'
import { profileRepository } from '../../data/repositories/profile'
import { MAX_PHOTO_PX } from '../../lib/image'
import { isoDay, slugify } from '../../lib/slug'
import {
  componentEvaluation,
  exportSource,
  mediaItem,
  profile,
  truckEvaluation,
} from '../../test/factories/export'
import { buildExcel, buildSheets } from './builders/excel'
import { buildGallery, galleryJsonText } from './builders/gallery'
import { buildDataJson, dataJsonText, evaluator } from './builders/json'
import { buildMarkdown, buildReadme, cell } from './builders/markdown'
import {
  evaluationFolder,
  extensionFor,
  prepareMedia,
  type ExportDoc,
  type ExportFile,
} from './builders/model'
import { splitBySize } from './builders/split'
import { createZip } from './builders/zip'
import { buildExport, estimateBytes, loadExportSource, wipeEvaluations, zipName } from './exporter'
import { canShareFiles, downloadFile, shareFiles } from './share'

const image = vi.hoisted(() => ({ resizeImage: vi.fn() }))
vi.mock('../../lib/image', () => ({ ...image, MAX_PHOTO_PX: 4096 }))

const converted = new Blob(['r'], { type: 'image/jpeg' })

beforeEach(() => {
  image.resizeImage.mockReset().mockResolvedValue(converted)
})

async function unzip(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()))
}

async function prepared() {
  const source = exportSource()
  return { source, files: await prepareMedia(source) }
}

function doc(source = exportSource(), files: ExportFile[] = [], patch: Partial<ExportDoc> = {}) {
  return {
    source,
    files,
    partOf: new Map(files.map((f) => [f.media.id, 1])),
    part: 1,
    totalParts: 1,
    videosIncluded: true,
    exportId: 'export-1',
    exportedAt: '2026-10-19T18:00:00.000Z',
    ...patch,
  } satisfies ExportDoc
}

describe('slug helpers', () => {
  it('builds ASCII slugs within the limit', () => {
    expect(slugify('  Seat belt, ajuste fácil! ')).toBe('Seat-belt-ajuste-facil')
    expect(slugify('João da Silva', 40, '_')).toBe('Joao_da_Silva')
    expect(slugify('one two three', 7)).toBe('one-two')
    expect(slugify('Supercalifragilistic', 5)).toBe('Super')
    expect(slugify('日本 !!')).toBe('')
    expect(isoDay(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09')
  })
})

describe('prepareMedia', () => {
  it('keeps original photos, converts HEIC to JPEG and names every file', async () => {
    const progress = vi.fn()
    const source = exportSource()
    const files = await prepareMedia(source, progress)
    expect(files.map((f) => f.path)).toEqual([
      'media/01_Tatra-Phoenix/brochure_01.jpg',
      'media/01_Tatra-Phoenix/feature_seats_01_Seat-belt-ajuste-facil.png',
      'media/01_Tatra-Phoenix/feature_seats_02.mp4',
      'media/01_Tatra-Phoenix/feature_bed_01.webm',
      'media/02_Battery/component_01_Mounting.png',
    ])
    expect(files[0]).toMatchObject({ blob: converted, mime: 'image/jpeg', evaluationNo: 1 })
    expect(files[1]).toMatchObject({ blob: source.media[1]!.blob, mime: 'image/png' })
    expect(files[2]!.blob).toBe(source.media[2]!.blob)
    expect(image.resizeImage).toHaveBeenCalledWith(source.media[0]!.blob, MAX_PHOTO_PX, 0.92)
    expect(image.resizeImage).toHaveBeenCalledTimes(1)
    expect(progress).toHaveBeenLastCalledWith(5, 5)
  })

  it('keeps the HEIC file when this device cannot decode it', async () => {
    image.resizeImage.mockRejectedValue(new Error('HEIC'))
    const fallback = await prepared()
    expect(fallback.files[0]).toMatchObject({
      mime: 'image/heic',
      blob: fallback.source.media[0]!.blob,
    })
    expect(fallback.files[0]!.path).toMatch(/brochure_01\.heic$/)
  })

  it('names feature media without a feature and untitled evaluations', async () => {
    const evaluation = componentEvaluation({
      component: { name: '日本', manufacturer: '', mediaIds: [], comments: '' },
    })
    const files = await prepareMedia({
      profile,
      evaluations: [evaluation],
      media: [
        mediaItem({
          id: 'a',
          evaluationId: evaluation.id,
          type: 'audio',
          mime: 'audio/x-unknown',
        }),
      ],
    })
    expect(files[0]!.path).toBe('media/01_component/feature_general_01.bin')
    expect(evaluationFolder(truckEvaluation(), 12)).toBe('12_Tatra-Phoenix')
  })

  it('maps MIME types to extensions', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionFor('VIDEO/QUICKTIME')).toBe('mov')
    expect(extensionFor('')).toBe('bin')
  })
})

describe('data.json', () => {
  it('follows the export schema', async () => {
    const { source, files } = await prepared()
    const partOf = new Map([['m-seat', 2]])
    const data = buildDataJson(doc(source, files, { partOf, part: 2, totalParts: 2 }))
    expect(data).toMatchObject({
      schema: 'fenatran-benchmark',
      schemaVersion: 2,
      questionnaireVersion: '2026.1',
      exportId: 'export-1',
      part: 2,
      totalParts: 2,
      photoQuality: 'original',
      videosIncluded: true,
      questionnaire: { scale: { min: 0, max: 5 } },
    })
    expect(data.questionnaire.features).toHaveLength(13)
    expect(data.evaluator).toEqual({ name: 'João da Silva', email: 'joao.silva@example.com' })
    const [truck, component] = data.evaluations
    expect(truck).toMatchObject({ no: 1, title: 'Tatra Phoenix', kind: 'truck' })
    expect(truck!.media[1]).toEqual({
      id: 'm-seat',
      file: 'media/01_Tatra-Phoenix/feature_seats_01_Seat-belt-ajuste-facil.png',
      part: 2,
      type: 'photo',
      role: 'feature',
      featureId: 'seats',
      caption: 'Seat belt, ajuste fácil',
      mime: 'image/png',
      durationSec: null,
      annotatedFromId: null,
      createdAt: '2026-10-19T10:30:00.000Z',
    })
    expect(truck!.media[0]).toMatchObject({ file: null, part: null, featureId: null })
    expect(truck!.media[3]!.durationSec).toBe(75)
    expect(component!.media[0]!.annotatedFromId).toBe('m-x')
    expect(JSON.parse(dataJsonText(doc(source, files)))).toMatchObject({ exportId: 'export-1' })
  })

  it('exports only name and e-mail of the evaluator', () => {
    const old = { ...profile, role: 'Manager' } as typeof profile
    expect(evaluator(old)).toEqual({ name: 'João da Silva', email: 'joao.silva@example.com' })
  })
})

describe('summary.md and README', () => {
  it('summarises each evaluation', async () => {
    const { source, files } = await prepared()
    const partOf = new Map(
      files.filter((f) => f.media.type !== 'video').map((f) => [f.media.id, 1]),
    )
    const md = buildMarkdown(doc(source, files, { partOf, videosIncluded: false }))
    expect(md).toContain('# FENATRAN 2026 Benchmark - João da Silva')
    expect(md).toContain('- Videos: not included')
    expect(md).toContain('- Photos: original')
    expect(md).toContain('- Evaluator: João da Silva (joao.silva@example.com)')
    expect(md).not.toMatch(/Role:|Area:|Confidential/)
    expect(md).toContain('## 1. Truck: Tatra Phoenix')
    expect(md).toContain('- Finalized: 2026-10-19T11:00:00.000Z')
    expect(md).toContain('- Features scored: 2 of 13')
    expect(md).toContain(
      '| 7 | Driver and passenger seats | 4 | Good \\| firm / lumbar support | 2 |',
    )
    expect(md).toContain('| 10 | Bed | 0 | - | 1 |')
    expect(md).toContain('| 1 | Robustness')
    expect(md).toMatch(/- video: \(not included in this export\) \[Driver and passenger seats\]/)
    expect(md).toContain(
      '- audio, 1:15: `media/01_Tatra-Phoenix/feature_bed_01.webm` (part 1) [Bed]',
    )
    expect(md).toContain('- photo: `media/01_Tatra-Phoenix/brochure_01.jpg` (part 1)\n')
    expect(md).toContain('Seat-belt-ajuste-facil.png` (part 1) - Seat belt, ajuste fácil')
    expect(md).toContain('## 2. Component: Battery')
    expect(md).toContain('- Manufacturer: Knorr')
    expect(md).toContain('> Compact\n> Good access')
    expect(md).not.toMatch(/## 2[\s\S]*Finalized/)
    expect(md.endsWith('\n')).toBe(true)
  })

  it('handles empty values and evaluations without media', () => {
    const evaluation = componentEvaluation({
      component: { name: 'Seat', manufacturer: ' ', mediaIds: [], comments: '' },
    })
    const md = buildMarkdown(
      doc({
        profile: { name: '', email: 'ana@example.com' },
        evaluations: [evaluation],
        media: [],
      }),
    )
    expect(md).toContain('# FENATRAN 2026 Benchmark - ana@example.com')
    expect(md).toContain('- Evaluator: ana@example.com\n')
    expect(md).toContain('- Manufacturer: -')
    expect(md).toContain('Comments:\n\n-\n')
    expect(md).toContain('No media.')
    expect(cell(' a\r\n b ')).toBe('a / b')
  })

  it('writes a README per part', () => {
    const text = buildReadme(doc(exportSource(), [], { part: 2, totalParts: 3 }))
    expect(text).toContain('Part 2 of 3')
    expect(text).toContain('Evaluator: João da Silva')
    expect(text).toContain('gallery.json')
    expect(text).not.toContain('Confidential')
    expect(text).toContain('\r\n')
    const anonymous = { ...exportSource(), profile: { name: '', email: 'bo@example.com' } }
    expect(buildReadme(doc(anonymous))).toContain('Evaluator: bo@example.com')
  })
})

describe('summary.xlsx', () => {
  it('has the Evaluations, Feature scores and Media sheets', async () => {
    const { source, files } = await prepared()
    const sheets = buildSheets(doc(source, files, { partOf: new Map([['m-seat', 1]]) }))
    expect(sheets.map((s) => s.sheet)).toEqual(['Evaluations', 'Feature scores', 'Media'])
    const [evaluations, scores, media] = sheets.map((s) => s.data)
    expect(evaluations).toHaveLength(3)
    expect(evaluations![1]!.slice(0, 7)).toEqual([
      1,
      'truck',
      'finalized',
      'Tatra Phoenix',
      'Tatra',
      'Phoenix',
      2,
    ])
    expect(evaluations![2]!.slice(4, 11)).toEqual([
      null,
      null,
      null,
      'Battery',
      'Knorr',
      'Compact\nGood access',
      1,
    ])
    expect(evaluations![2]![13]).toBeNull()
    expect(scores).toHaveLength(14)
    expect(scores![7]).toEqual([
      1,
      'Tatra Phoenix',
      7,
      'seats',
      'Driver and passenger seats',
      4,
      'Good | firm\nlumbar support',
      2,
    ])
    expect(scores![1]!.slice(5)).toEqual([null, null, 0])
    expect(media).toHaveLength(6)
    expect(media![1]![6]).toBe('not included')
    expect(media![2]!.slice(4, 8)).toEqual(['seats', 'Seat belt, ajuste fácil', files[1]!.path, 1])
    expect(media![4]![8]).toBe(75)
  })

  it('creates a real workbook', async () => {
    const blob = await buildExcel(doc())
    const entries = await unzip(blob)
    expect(Object.keys(entries)).toContain('xl/worksheets/sheet3.xml')
    expect(strFromU8(entries['xl/workbook.xml']!)).toContain('Feature scores')
  })
})

describe('gallery.json', () => {
  function captioned() {
    const source = exportSource()
    source.media = source.media.map((m) =>
      m.id === 'm-video' || m.id === 'm-audio' ? { ...m, caption: `  ${m.id} caption ` } : m,
    )
    return source
  }

  it('lists captioned photos and videos with their evaluation context', async () => {
    const source = captioned()
    const files = await prepareMedia(source)
    const gallery = buildGallery(doc(source, files))
    expect(gallery).toMatchObject({
      schema: 'fenatran-gallery',
      schemaVersion: 1,
      exportId: 'export-1',
      part: 1,
      totalParts: 1,
      evaluatorEmail: 'joao.silva@example.com',
      evaluatorName: 'João da Silva',
    })
    expect(gallery.items.map((i) => i.mediaId)).toEqual(['m-seat', 'm-video', 'm-comp'])
    expect(gallery.items[0]).toEqual({
      mediaId: 'm-seat',
      file: 'media/01_Tatra-Phoenix/feature_seats_01_Seat-belt-ajuste-facil.png',
      type: 'photo',
      caption: 'Seat belt, ajuste fácil',
      evaluationNo: 1,
      evaluationId: 'truck-1',
      kind: 'truck',
      title: 'Tatra Phoenix',
      brand: 'Tatra',
      model: 'Phoenix',
      featureId: 'seats',
      featureTitle: 'Driver and passenger seats',
      componentName: null,
      manufacturer: null,
      createdAt: '2026-10-19T10:30:00.000Z',
    })
    expect(gallery.items[1]).toMatchObject({ type: 'video', caption: 'm-video caption' })
    expect(gallery.items[2]).toMatchObject({
      kind: 'component',
      title: 'Battery',
      brand: null,
      model: null,
      featureId: null,
      featureTitle: null,
      componentName: 'Battery',
      manufacturer: 'Knorr',
    })
  })

  it('keeps only the media stored in this part', async () => {
    const source = captioned()
    const files = await prepareMedia(source)
    const partOf = new Map(files.map((f) => [f.media.id, f.media.id === 'm-comp' ? 2 : 1]))
    const second = JSON.parse(
      galleryJsonText(doc(source, files, { partOf, part: 2, totalParts: 2 })),
    )
    expect(second.items.map((i: { mediaId: string }) => i.mediaId)).toEqual(['m-comp'])
    expect(second).toMatchObject({ part: 2, totalParts: 2 })
  })

  it('leaves empty truck fields as null', async () => {
    const source = exportSource()
    source.evaluations[0] = truckEvaluation({
      truck: { brand: '', model: '  ', brochureMediaIds: [], features: {} },
    })
    const files = await prepareMedia(source)
    const item = buildGallery(doc(source, files)).items[0]!
    expect(item).toMatchObject({ title: 'Untitled truck', brand: null, model: null })
  })
})
describe('createZip', () => {
  it('stores media and deflates text', async () => {
    const zip = await createZip([
      { path: 'data.json', data: '{"a":1}' },
      { path: 'media/01_x/photo.jpg', data: new Blob(['jpeg']) },
    ])
    expect(zip.type).toBe('application/zip')
    const entries = await unzip(zip)
    expect(strFromU8(entries['data.json']!)).toBe('{"a":1}')
    expect(strFromU8(entries['media/01_x/photo.jpg']!)).toBe('jpeg')
  })
})

describe('splitBySize', () => {
  const size = (n: number) => n

  it('packs greedily and keeps the original order inside each part', () => {
    expect(splitBySize([3, 6, 4, 5], size, 10)).toEqual([
      [6, 4],
      [3, 5],
    ])
    expect(splitBySize([12, 1], size, 10)).toEqual([[12], [1]])
    expect(splitBySize([2, 2], size, 10)).toEqual([[2, 2]])
  })

  it('always returns one part', () => {
    expect(splitBySize([], size, 10)).toEqual([[]])
  })
})

describe('exporter', () => {
  beforeEach(async () => {
    await db.evaluations.clear()
    await db.media.clear()
    await db.profile.clear()
  })

  it('loads nothing without a profile, else the evaluations oldest first', async () => {
    expect(await loadExportSource()).toBeNull()
    await profileRepository.save(profile)
    await db.evaluations.bulkPut([componentEvaluation(), truckEvaluation()])
    await db.media.put({
      ...mediaItem({ id: 'orphan', evaluationId: 'truck-1' }),
      blob: { size: 1 } as Blob,
    })
    const source = await loadExportSource()
    expect(source?.evaluations.map((e) => e.id)).toEqual(['truck-1', 'component-1'])
    expect(source?.media.map((m) => m.id)).toEqual(['orphan'])
    expect(source?.profile.name).toBe('João da Silva')
  })

  it('wipes evaluations and media but keeps the profile', async () => {
    await profileRepository.save(profile)
    await db.evaluations.put(truckEvaluation())
    await db.media.put({
      ...mediaItem({ id: 'm', evaluationId: 'truck-1' }),
      blob: { size: 1 } as Blob,
    })
    await wipeEvaluations()
    expect(await evaluationRepository.list()).toEqual([])
    expect(await db.media.count()).toBe(0)
    expect(await profileRepository.get()).toEqual(profile)
  })

  it('names ZIP files', () => {
    const day = new Date(2026, 9, 19, 9)
    expect(zipName('João da Silva', day)).toBe('FENATRAN2026_Joao_da_Silva_2026-10-19.zip')
    expect(zipName('日本', day, 2, 3)).toBe('FENATRAN2026_Evaluator_2026-10-19_part2of3.zip')
  })

  it('estimates the size with or without videos', async () => {
    const { files } = await prepared()
    expect(estimateBytes(files, true) - estimateBytes(files, false)).toBe(40)
  })

  it('builds one ZIP with all documents and media', async () => {
    const { source, files } = await prepared()
    const now = new Date(2026, 9, 19, 18)
    const result = await buildExport(source, files, { includeVideos: true, split: false }, now)
    expect(result.zips.map((z) => z.name)).toEqual(['FENATRAN2026_Joao_da_Silva_2026-10-19.zip'])
    const entries = await unzip(result.zips[0]!)
    expect(Object.keys(entries)).toEqual([
      'data.json',
      'gallery.json',
      'summary.md',
      'summary.xlsx',
      'README.txt',
      ...files.map((f) => f.path),
    ])
    const data = JSON.parse(strFromU8(entries['data.json']!))
    expect(data).toMatchObject({ part: 1, totalParts: 1, exportedAt: now.toISOString() })
    const gallery = JSON.parse(strFromU8(entries['gallery.json']!))
    expect(gallery.items.map((i: { mediaId: string }) => i.mediaId)).toEqual(['m-seat', 'm-comp'])
  })

  it('names the ZIP after the e-mail when the name is empty', async () => {
    const source = { ...exportSource(), profile: { name: '', email: 'ana.souza@example.com' } }
    const result = await buildExport(source, [], { includeVideos: true, split: false })
    expect(result.zips[0]!.name).toMatch(/^FENATRAN2026_ana\.souza_|^FENATRAN2026_ana_souza_/)
  })

  it('splits into parts that each hold data.json, and can leave videos out', async () => {
    const { source, files } = await prepared()
    const limit = 2 * 1024 * 1024 + 1
    const result = await buildExport(source, files, {
      includeVideos: false,
      split: true,
      limit,
    })
    expect(result.zips).toHaveLength(4)
    expect(result.zips[3]!.name).toMatch(/_part4of4\.zip$/)
    const seen: string[] = []
    for (const zip of result.zips) {
      const entries = await unzip(zip)
      const data = JSON.parse(strFromU8(entries['data.json']!))
      expect(data).toMatchObject({ totalParts: 4, videosIncluded: false, photoQuality: 'original' })
      seen.push(...Object.keys(entries).filter((k) => k.startsWith('media/')))
      const video = data.evaluations[0].media.find((m: { type: string }) => m.type === 'video')
      expect(video).toMatchObject({ file: null, part: null })
    }
    expect(seen.sort()).toEqual(
      files
        .filter((f) => f.media.type !== 'video')
        .map((f) => f.path)
        .sort(),
    )
  })
})

describe('share', () => {
  const file = new File(['z'], 'a.zip', { type: 'application/zip' })

  function stubShare(share?: unknown, canShare?: unknown) {
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare })
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('detects file sharing support', () => {
    expect(canShareFiles([file])).toBe(false)
    stubShare(vi.fn())
    expect(canShareFiles([file])).toBe(false)
    stubShare(vi.fn(), () => true)
    expect(canShareFiles([])).toBe(false)
    expect(canShareFiles([file])).toBe(true)
    stubShare(vi.fn(), () => {
      throw new TypeError('bad')
    })
    expect(canShareFiles([file])).toBe(false)
  })

  it('shares files and reports the outcome', async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined)
    stubShare(share)
    expect(await shareFiles([file], 'Title', 'Text')).toBe('shared')
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Title', text: 'Text' })
    share.mockRejectedValueOnce(new DOMException('no', 'AbortError'))
    expect(await shareFiles([file], 'Title')).toBe('cancelled')
    share.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    expect(await shareFiles([file], 'Title')).toBe('failed')
    share.mockRejectedValueOnce(new Error('x'))
    expect(await shareFiles([file], 'Title')).toBe('failed')
  })

  it('downloads through a temporary link', () => {
    vi.useFakeTimers()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('a.zip')
      expect(document.body.contains(this)).toBe(true)
    })
    downloadFile(file)
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a')).toBeNull()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})
