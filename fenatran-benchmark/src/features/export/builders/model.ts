import type { Evaluation, Media, Profile } from '../../../data/types'
import { evaluationTitle } from '../../../lib/evaluation'
import { MAX_PHOTO_PX, resizeImage } from '../../../lib/image'
import { slugify } from '../../../lib/slug'

// Formats that browsers and common gallery tools can show as they are.
const WEB_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// Everything on the device. `media` holds all media rows of each evaluation (same rule as the
// confirmation summary), including rows no longer referenced by ids.
export type ExportSource = { profile: Profile; evaluations: Evaluation[]; media: Media[] }

export type ExportFile = {
  media: Media
  evaluationNo: number
  // Path inside the ZIP.
  path: string
  blob: Blob
  mime: string
}

// One export part: which media went into which ZIP (missing id = not included, e.g. videos left out).
export type ExportDoc = {
  source: ExportSource
  files: ExportFile[]
  partOf: ReadonlyMap<string, number>
  part: number
  totalParts: number
  videosIncluded: boolean
  exportId: string
  exportedAt: string
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
}

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime.split(';')[0]!.trim().toLowerCase()] ?? 'bin'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function evaluationFolder(evaluation: Evaluation, no: number): string {
  return `${pad2(no)}_${slugify(evaluationTitle(evaluation)) || evaluation.kind}`
}

// Photos keep their stored quality. Formats a browser cannot show (HEIC, HEIF) are converted to
// JPEG at full size when this device can decode them; otherwise the original file is kept.
async function exportBlob(media: Media) {
  const mime = media.mime.split(';')[0]!.trim().toLowerCase()
  if (media.type !== 'photo' || WEB_IMAGES.has(mime)) return { blob: media.blob, mime: media.mime }
  try {
    return { blob: await resizeImage(media.blob, MAX_PHOTO_PX, 0.92), mime: 'image/jpeg' }
  } catch {
    return { blob: media.blob, mime: media.mime }
  }
}

// Names every file: media/<nn_evaluation>/<role>[_<feature>]_<nn>[_<caption>].<ext>
export async function prepareMedia(
  source: ExportSource,
  onProgress?: (done: number, total: number) => void,
): Promise<ExportFile[]> {
  const files: ExportFile[] = []
  const total = source.media.length
  for (const [index, evaluation] of source.evaluations.entries()) {
    const no = index + 1
    const folder = evaluationFolder(evaluation, no)
    const counters = new Map<string, number>()
    for (const media of source.media.filter((m) => m.evaluationId === evaluation.id)) {
      const { blob, mime } = await exportBlob(media)
      const prefix =
        media.role === 'feature' ? `feature_${media.featureId ?? 'general'}` : media.role
      const n = (counters.get(prefix) ?? 0) + 1
      counters.set(prefix, n)
      const caption = slugify(media.caption)
      const base = `${prefix}_${pad2(n)}${caption ? `_${caption}` : ''}.${extensionFor(mime)}`
      files.push({ media, evaluationNo: no, path: `media/${folder}/${base}`, blob, mime })
      onProgress?.(files.length, total)
    }
  }
  return files
}
