import { FEATURES, QUESTIONNAIRE_VERSION, SCALE } from '../../../config/questionnaire'
import type { Evaluation, Media, Profile } from '../../../data/types'
import { evaluationTitle } from '../../../lib/evaluation'
import type { ExportDoc } from './model'

export const SCHEMA = 'fenatran-benchmark'
const SCHEMA_VERSION = 2

export type MediaEntry = {
  id: string
  // Path inside the ZIP; null when the file was left out (videos excluded).
  file: string | null
  // ZIP part that holds the file; null when left out.
  part: number | null
  type: Media['type']
  role: Media['role']
  featureId: string | null
  caption: string
  mime: string
  durationSec: number | null
  annotatedFromId: string | null
  createdAt: string
}

export type Evaluator = Profile

export type DataJson = {
  schema: typeof SCHEMA
  schemaVersion: typeof SCHEMA_VERSION
  questionnaireVersion: string
  exportId: string
  exportedAt: string
  part: number
  totalParts: number
  photoQuality: 'original'
  videosIncluded: boolean
  questionnaire: { scale: typeof SCALE; features: typeof FEATURES }
  evaluator: Evaluator
  evaluations: (Evaluation & { no: number; title: string; media: MediaEntry[] })[]
}

export function evaluator(profile: Profile): Evaluator {
  return { name: profile.name, email: profile.email }
}

export function mediaEntries(doc: ExportDoc, evaluationId: string): MediaEntry[] {
  return doc.files
    .filter((file) => file.media.evaluationId === evaluationId)
    .map(({ media, path }) => {
      const part = doc.partOf.get(media.id) ?? null
      return {
        id: media.id,
        file: part === null ? null : path,
        part,
        type: media.type,
        role: media.role,
        featureId: media.featureId ?? null,
        caption: media.caption,
        mime: media.mime,
        durationSec: media.durationSec ?? null,
        annotatedFromId: media.annotatedFromId ?? null,
        createdAt: media.createdAt,
      }
    })
}

export function buildDataJson(doc: ExportDoc): DataJson {
  return {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    exportId: doc.exportId,
    exportedAt: doc.exportedAt,
    part: doc.part,
    totalParts: doc.totalParts,
    photoQuality: 'original',
    videosIncluded: doc.videosIncluded,
    questionnaire: { scale: SCALE, features: FEATURES },
    evaluator: evaluator(doc.source.profile),
    evaluations: doc.source.evaluations.map((evaluation, index) => ({
      ...evaluation,
      no: index + 1,
      title: evaluationTitle(evaluation),
      media: mediaEntries(doc, evaluation.id),
    })),
  }
}

export function dataJsonText(doc: ExportDoc): string {
  return JSON.stringify(buildDataJson(doc), null, 2)
}
