import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import type { Media } from '../../data/types'
import { objectUrl } from '../../lib/objectUrl'
import { mediaTypeOf, useMediaLibrary } from './useMediaLibrary'

function seed(overrides: Partial<Media> = {}): Media {
  return {
    id: 'seed-1',
    evaluationId: 'ev-1',
    role: 'feature',
    featureId: 'f-1',
    type: 'photo',
    mime: 'image/jpeg',
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    caption: 'Seeded',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await db.media.clear()
  vi.mocked(URL.revokeObjectURL).mockClear()
})

describe('mediaTypeOf', () => {
  it('detects the type from the mime type', () => {
    expect(mediaTypeOf({ type: 'image/png', name: 'a' })).toBe('photo')
    expect(mediaTypeOf({ type: 'video/mp4', name: 'a' })).toBe('video')
    expect(mediaTypeOf({ type: 'audio/mpeg', name: 'a' })).toBe('audio')
  })

  it('falls back to the file extension', () => {
    expect(mediaTypeOf({ type: '', name: 'IMG.HEIC' })).toBe('photo')
    expect(mediaTypeOf({ type: '', name: 'clip.mov' })).toBe('video')
    expect(mediaTypeOf({ type: 'application/octet-stream', name: 'note.m4a' })).toBe('audio')
  })

  it('returns null for unsupported files', () => {
    expect(mediaTypeOf({ type: 'text/plain', name: 'notes.txt' })).toBeNull()
  })
})

describe('useMediaLibrary', () => {
  it('loads the media of the evaluation', async () => {
    await db.media.bulkAdd([seed(), seed({ id: 'other', evaluationId: 'ev-2' })])
    const { result } = renderHook(() => useMediaLibrary('ev-1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.byId.get('seed-1')?.caption).toBe('Seeded')
    expect(result.current.byId.has('other')).toBe(false)
  })

  it('ignores a load that resolves after the evaluation changed', async () => {
    await db.media.bulkAdd([seed(), seed({ id: 'other', evaluationId: 'ev-2' })])
    const { result, rerender } = renderHook(({ id }) => useMediaLibrary(id), {
      initialProps: { id: 'ev-1' },
    })
    rerender({ id: 'ev-2' })
    await waitFor(() => expect(result.current.items.map((m) => m.id)).toEqual(['other']))
  })

  it('adds files, counting unsupported ones as failed', async () => {
    const { result } = renderHook(() => useMediaLibrary('ev-1'))
    const photo = new File(['p'], 'photo.jpg', { type: 'image/jpeg' })
    const video = new File(['v'], 'clip.mp4', { type: 'video/mp4' })
    const untyped = new File(['a'], 'note.m4a')
    const text = new File(['t'], 'notes.txt', { type: 'text/plain' })

    let outcome: Awaited<ReturnType<typeof result.current.addFiles>> | undefined
    await act(async () => {
      outcome = await result.current.addFiles([photo, video, untyped, text], {
        role: 'feature',
        featureId: 'f-9',
      })
    })

    expect(outcome?.ids).toHaveLength(3)
    expect(outcome?.failed).toBe(1)
    const [p, v, a] = outcome!.ids.map((id) => result.current.byId.get(id)!)
    expect(p).toMatchObject({ type: 'photo', mime: 'image/jpeg', featureId: 'f-9', caption: '' })
    expect(p!.blob).toBe(photo)
    expect(v).toMatchObject({ type: 'video', mime: 'video/mp4' })
    expect(a).toMatchObject({ type: 'audio', mime: 'application/octet-stream' })
    expect(await db.media.count()).toBe(3)
  })

  it('adds a recording without a feature id', async () => {
    const { result } = renderHook(() => useMediaLibrary('ev-1'))
    const blob = new Blob(['r'], { type: 'audio/webm' })
    let id = ''
    await act(async () => {
      id = await result.current.addRecording(blob, 7, { role: 'component' })
    })
    const media = result.current.byId.get(id)!
    expect(media).toMatchObject({ type: 'audio', mime: 'audio/webm', durationSec: 7 })
    expect(media).not.toHaveProperty('featureId')
  })

  it('saves a marked-up copy as new media and keeps the original', async () => {
    const source = seed()
    await db.media.add(source)
    const { result } = renderHook(() => useMediaLibrary('ev-1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    let id = ''
    await act(async () => {
      id = await result.current.addAnnotated(source, new Blob(['m'], { type: 'image/jpeg' }))
    })
    expect(result.current.items).toHaveLength(2)
    expect(result.current.byId.get(id)).toMatchObject({
      type: 'photo',
      role: 'feature',
      featureId: 'f-1',
      caption: 'Seeded',
      annotatedFromId: 'seed-1',
    })
  })

  it('updates a caption', async () => {
    await db.media.bulkAdd([seed(), seed({ id: 'seed-2', caption: 'Second' })])
    const { result } = renderHook(() => useMediaLibrary('ev-1'))
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    await act(() => result.current.updateCaption('seed-1', 'Changed'))
    expect(result.current.byId.get('seed-1')?.caption).toBe('Changed')
    expect(result.current.byId.get('seed-2')?.caption).toBe('Second')
    expect((await db.media.get('seed-1'))?.caption).toBe('Changed')
  })

  it('removes media and revokes its object URLs', async () => {
    await db.media.bulkAdd([seed(), seed({ id: 'seed-2' })])
    const { result } = renderHook(() => useMediaLibrary('ev-1'))
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    const first = {
      ...result.current.byId.get('seed-1')!,
      blob: new Blob(['a']),
      thumb: new Blob(),
    }
    objectUrl(first.blob)
    objectUrl(first.thumb)
    await act(() => result.current.remove(first))
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)

    const second = { ...result.current.byId.get('seed-2')!, blob: new Blob(['b']) }
    objectUrl(second.blob)
    await act(() => result.current.remove(second))
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)

    expect(result.current.items).toHaveLength(0)
    expect(await db.media.count()).toBe(0)
  })
})
