import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Evaluation } from '../data/types'
import { brandLabel, evaluationTitle, scoredCount } from './evaluation'
import { formatBytes, formatDateTime, formatDuration, plural } from './format'
import {
  canvasToJpeg,
  fitWithin,
  loadImage,
  MAX_PHOTO_PX,
  preparePhoto,
  resizeImage,
  THUMB_PX,
} from './image'
import { objectUrl, revokeObjectUrl } from './objectUrl'

const base = { id: '1', status: 'draft', createdAt: '', updatedAt: '' } as const

describe('format', () => {
  it('formats bytes', () => {
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB')
    expect(formatBytes(2048 * 1024 ** 3)).toBe('2048 GB')
  })

  it('formats durations and dates', () => {
    expect(plural(1, 'photo')).toBe('1 photo')
    expect(plural(0, 'video')).toBe('0 videos')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(-3)).toBe('0:00')
    expect(formatDateTime('2026-10-19T15:30:00.000Z')).toMatch(/Oct/)
  })
})

describe('evaluation helpers', () => {
  const truck = (brand: string, model: string, brandOther?: string): Evaluation => ({
    ...base,
    kind: 'truck',
    truck: { brand, brandOther, model, brochureMediaIds: [], features: {} },
  })

  it('builds titles and brand labels', () => {
    expect(brandLabel('Scania')).toBe('Scania')
    expect(brandLabel('Other')).toBe('')
    expect(evaluationTitle(truck('Scania', ' R 450 '))).toBe('Scania R 450')
    expect(evaluationTitle(truck('Other', 'X', ' Hyundai '))).toBe('Hyundai X')
    expect(evaluationTitle(truck('', ''))).toBe('Untitled truck')
    expect(evaluationTitle({ ...base, kind: 'truck' })).toBe('Untitled truck')
    expect(
      evaluationTitle({
        ...base,
        kind: 'component',
        component: { name: ' Seat ', manufacturer: '', mediaIds: [], comments: '' },
      }),
    ).toBe('Seat')
    expect(evaluationTitle({ ...base, kind: 'component' })).toBe('Untitled component')
  })

  it('counts scored features', () => {
    const e = truck('Volvo', 'FH')
    e.truck!.features = {
      a: { score: 0, comment: '', mediaIds: [] },
      b: { score: null, comment: 'x', mediaIds: [] },
    }
    expect(scoredCount(e)).toBe(1)
    expect(scoredCount({ ...base, kind: 'component' })).toBe(0)
  })
})

describe('objectUrl', () => {
  it('caches one URL per blob and revokes it', () => {
    const blob = new Blob(['a'])
    const url = objectUrl(blob)
    expect(objectUrl(blob)).toBe(url)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    revokeObjectUrl(blob)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    revokeObjectUrl(blob)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(objectUrl(blob)).not.toBe(url)
  })
})

describe('image', () => {
  const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
  const close = vi.fn()

  function stubCanvas(blob: Blob | null = new Blob(['jpg'], { type: 'image/jpeg' })) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
      cb(blob)
    })
  }
  function stubBitmap(width: number, height: number) {
    const create = vi.fn().mockResolvedValue({ width, height, close })
    vi.stubGlobal('createImageBitmap', create)
    return create
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    ctx.drawImage.mockClear()
    close.mockClear()
  })

  it('fits sizes within a maximum', () => {
    expect(fitWithin(8000, 4000, 4096)).toEqual({ width: 4096, height: 2048 })
    expect(fitWithin(100, 50, 4096)).toEqual({ width: 100, height: 50 })
    expect(fitWithin(0, 0, 10)).toEqual({ width: 1, height: 1 })
  })

  it('resizes through a canvas and releases the bitmap', async () => {
    stubCanvas()
    const create = stubBitmap(8192, 6144)
    const out = await resizeImage(new Blob(['raw']))
    expect(out.type).toBe('image/jpeg')
    expect(create).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: 'from-image' })
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, MAX_PHOTO_PX, 3072)
    expect(close).toHaveBeenCalled()
  })

  it('rejects without decoder, canvas context or encoder output', async () => {
    await expect(resizeImage(new Blob(['x']))).rejects.toThrow('No decoder')
    stubBitmap(10, 10)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(resizeImage(new Blob(['x']))).rejects.toThrow('Canvas unavailable')
    expect(close).toHaveBeenCalled()
    stubCanvas(null)
    await expect(canvasToJpeg(document.createElement('canvas'))).rejects.toThrow('Encoding failed')
  })

  it('prepares a stored copy and a thumbnail', async () => {
    stubCanvas()
    stubBitmap(1000, 500)
    const photo = await preparePhoto(new Blob(['raw'], { type: 'image/png' }))
    expect(photo.mime).toBe('image/jpeg')
    expect(photo.thumb).toBeInstanceOf(Blob)
    expect(ctx.drawImage).toHaveBeenLastCalledWith(expect.anything(), 0, 0, THUMB_PX, 160)
  })

  it('keeps the original when the photo cannot be decoded', async () => {
    const heic = new Blob(['raw'], { type: 'image/heic' })
    expect(await preparePhoto(heic)).toEqual({ blob: heic, mime: 'image/heic' })
    const unknown = new Blob(['raw'])
    expect((await preparePhoto(unknown)).mime).toBe('image/jpeg')
  })

  it('loads images from URLs', async () => {
    class FakeImage {
      onload: () => void = () => undefined
      onerror: () => void = () => undefined
      set src(value: string) {
        queueMicrotask(() => (value.includes('bad') ? this.onerror() : this.onload()))
      }
    }
    vi.stubGlobal('Image', FakeImage)
    await expect(loadImage('blob:good')).resolves.toBeInstanceOf(FakeImage)
    await expect(loadImage('blob:bad')).rejects.toThrow('Image could not be loaded')
  })
})
