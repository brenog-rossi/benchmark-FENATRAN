import { evaluationRepository } from '../../data/repositories/evaluation'
import { mediaRepository } from '../../data/repositories/media'
import { profileRepository } from '../../data/repositories/profile'
import { newId } from '../../lib/ids'
import { isoDay, slugify } from '../../lib/slug'
import { buildExcel } from './builders/excel'
import { galleryJsonText } from './builders/gallery'
import { dataJsonText } from './builders/json'
import { buildMarkdown, buildReadme } from './builders/markdown'
import type { ExportDoc, ExportFile, ExportSource } from './builders/model'
import { splitBySize } from './builders/split'
import { createZip } from './builders/zip'

// WhatsApp document limit used for the "big ZIP" question and as the part size.
export const ZIP_LIMIT = 100 * 1024 * 1024
// Room kept in every part for data.json, summaries, README and ZIP headers.
const DOC_RESERVE = 2 * 1024 * 1024

export type ExportOptions = {
  includeVideos: boolean
  split: boolean
  limit?: number
}

export type ExportResult = { zips: File[] }

// Oldest evaluation first, so numbering follows the day.
export async function loadExportSource(): Promise<ExportSource | null> {
  const profile = await profileRepository.get()
  if (!profile) return null
  const evaluations = (await evaluationRepository.list()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
  const media = (
    await Promise.all(evaluations.map((e) => mediaRepository.listByEvaluation(e.id)))
  ).flat()
  return { profile, evaluations, media }
}

export function includedFiles(files: ExportFile[], includeVideos: boolean): ExportFile[] {
  return includeVideos ? files : files.filter((f) => f.media.type !== 'video')
}

export function estimateBytes(files: ExportFile[], includeVideos: boolean): number {
  return includedFiles(files, includeVideos).reduce((sum, f) => sum + f.blob.size, DOC_RESERVE)
}

export function zipName(name: string, date: Date, part = 1, totalParts = 1): string {
  const who = slugify(name, 40, '_') || 'Evaluator'
  const suffix = totalParts > 1 ? `_part${part}of${totalParts}` : ''
  return `FENATRAN2026_${who}_${isoDay(date)}${suffix}.zip`
}

export async function buildExport(
  source: ExportSource,
  files: ExportFile[],
  options: ExportOptions,
  now = new Date(),
): Promise<ExportResult> {
  const included = includedFiles(files, options.includeVideos)
  const capacity = (options.limit ?? ZIP_LIMIT) - DOC_RESERVE
  const groups = options.split ? splitBySize(included, (f) => f.blob.size, capacity) : [included]
  const partOf = new Map<string, number>()
  groups.forEach((group, index) => {
    for (const file of group) partOf.set(file.media.id, index + 1)
  })

  const base = {
    source,
    files,
    partOf,
    totalParts: groups.length,
    videosIncluded: options.includeVideos,
    exportId: newId(),
    exportedAt: now.toISOString(),
  }
  const zips: File[] = []
  for (const [index, group] of groups.entries()) {
    const doc: ExportDoc = { ...base, part: index + 1 }
    const blob = await createZip([
      { path: 'data.json', data: dataJsonText(doc) },
      { path: 'gallery.json', data: galleryJsonText(doc) },
      { path: 'summary.md', data: buildMarkdown(doc) },
      { path: 'summary.xlsx', data: await buildExcel(doc) },
      { path: 'README.txt', data: buildReadme(doc) },
      ...group.map((f) => ({ path: f.path, data: f.blob })),
    ])
    const who = source.profile.name || source.profile.email.split('@')[0]!
    const name = zipName(who, now, index + 1, groups.length)
    zips.push(new File([blob], name, { type: 'application/zip' }))
  }

  return { zips }
}

// "I sent everything": evaluations and media go, the profile stays.
export async function wipeEvaluations(): Promise<void> {
  await evaluationRepository.removeAll()
}
