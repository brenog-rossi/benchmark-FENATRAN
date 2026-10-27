import { useCallback, useEffect, useMemo, useState } from 'react'
import { mediaRepository } from '../../data/repositories/media'
import type { Media, MediaRole, MediaType } from '../../data/types'
import { newId, nowIso } from '../../lib/ids'
import { preparePhoto } from '../../lib/image'
import { revokeObjectUrl } from '../../lib/objectUrl'

export type MediaTarget = { role: MediaRole; featureId?: string }
export type AddResult = { ids: string[]; failed: number }

const EXTENSIONS: Record<MediaType, RegExp> = {
  photo: /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i,
  video: /\.(mp4|mov|m4v|webm|3gp|mkv)$/i,
  audio: /\.(m4a|mp3|aac|wav|ogg|oga|opus|amr|weba)$/i,
}

export function mediaTypeOf(file: { type: string; name: string }): MediaType | null {
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  const match = (Object.keys(EXTENSIONS) as MediaType[]).find((t) => EXTENSIONS[t].test(file.name))
  return match ?? null
}

// All media of one evaluation, kept in memory while the editor is open.
export function useMediaLibrary(evaluationId: string) {
  const [items, setItems] = useState<Media[]>([])

  useEffect(() => {
    let active = true
    void mediaRepository.listByEvaluation(evaluationId).then((list) => {
      if (active) setItems(list)
    })
    return () => {
      active = false
    }
  }, [evaluationId])

  const byId = useMemo(() => new Map(items.map((m) => [m.id, m])), [items])

  const store = useCallback(async (media: Media) => {
    await mediaRepository.add(media)
    setItems((all) => [...all, media])
    return media.id
  }, [])

  const base = useCallback(
    (target: MediaTarget) => ({
      id: newId(),
      evaluationId,
      role: target.role,
      ...(target.featureId ? { featureId: target.featureId } : {}),
      caption: '',
      createdAt: nowIso(),
    }),
    [evaluationId],
  )

  const addFiles = useCallback(
    async (files: File[], target: MediaTarget): Promise<AddResult> => {
      const ids: string[] = []
      let failed = 0
      for (const file of files) {
        const type = mediaTypeOf(file)
        try {
          if (!type) throw new Error('Unsupported file')
          const content =
            type === 'photo'
              ? await preparePhoto(file)
              : { blob: file, mime: file.type || 'application/octet-stream' }
          ids.push(await store({ ...base(target), type, ...content }))
        } catch {
          failed += 1
        }
      }
      return { ids, failed }
    },
    [base, store],
  )

  const addRecording = useCallback(
    (blob: Blob, durationSec: number, target: MediaTarget) =>
      store({ ...base(target), type: 'audio', mime: blob.type, blob, durationSec }),
    [base, store],
  )

  // Saves the marked-up copy as new media; the original stays untouched.
  const addAnnotated = useCallback(
    async (source: Media, blob: Blob) => {
      const photo = await preparePhoto(blob)
      return store({
        ...base({ role: source.role, featureId: source.featureId }),
        type: 'photo',
        ...photo,
        caption: source.caption,
        annotatedFromId: source.id,
      })
    },
    [base, store],
  )

  const updateCaption = useCallback(async (id: string, caption: string) => {
    await mediaRepository.update(id, { caption })
    setItems((all) => all.map((m) => (m.id === id ? { ...m, caption } : m)))
  }, [])

  const remove = useCallback(async (media: Media) => {
    await mediaRepository.remove(media.id)
    revokeObjectUrl(media.blob)
    if (media.thumb) revokeObjectUrl(media.thumb)
    setItems((all) => all.filter((m) => m.id !== media.id))
  }, [])

  return { items, byId, addFiles, addRecording, addAnnotated, updateCaption, remove }
}

export type MediaLibrary = ReturnType<typeof useMediaLibrary>
