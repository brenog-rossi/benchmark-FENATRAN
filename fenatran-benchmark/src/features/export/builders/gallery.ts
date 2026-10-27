import { FEATURES } from '../../../config/questionnaire'
import { brandLabel, evaluationTitle } from '../../../lib/evaluation'
import type { ExportDoc } from './model'

export const GALLERY_SCHEMA = 'fenatran-gallery'
const GALLERY_VERSION = 1

// One flat row per captioned photo or video in this ZIP part, ready for a gallery or carousel.
export type GalleryItem = {
  mediaId: string
  file: string
  type: 'photo' | 'video'
  caption: string
  evaluationNo: number
  evaluationId: string
  kind: 'truck' | 'component'
  title: string
  brand: string | null
  model: string | null
  featureId: string | null
  featureTitle: string | null
  componentName: string | null
  manufacturer: string | null
  createdAt: string
}

export type GalleryJson = {
  schema: typeof GALLERY_SCHEMA
  schemaVersion: typeof GALLERY_VERSION
  exportId: string
  exportedAt: string
  part: number
  totalParts: number
  evaluatorEmail: string
  evaluatorName: string
  items: GalleryItem[]
}

export function buildGallery(doc: ExportDoc): GalleryJson {
  const { profile, evaluations } = doc.source
  const items: GalleryItem[] = []
  for (const { media, evaluationNo, path } of doc.files) {
    const caption = media.caption.trim()
    if (media.type === 'audio' || !caption || doc.partOf.get(media.id) !== doc.part) continue
    const evaluation = evaluations[evaluationNo - 1]!
    const truck = evaluation.truck
    const component = evaluation.component
    const feature = FEATURES.find((f) => f.id === media.featureId)
    items.push({
      mediaId: media.id,
      file: path,
      type: media.type,
      caption,
      evaluationNo,
      evaluationId: evaluation.id,
      kind: evaluation.kind,
      title: evaluationTitle(evaluation),
      brand: truck ? brandLabel(truck.brand, truck.brandOther) || null : null,
      model: truck?.model.trim() || null,
      featureId: feature?.id ?? null,
      featureTitle: feature?.title ?? null,
      componentName: component?.name.trim() || null,
      manufacturer: component?.manufacturer.trim() || null,
      createdAt: media.createdAt,
    })
  }
  return {
    schema: GALLERY_SCHEMA,
    schemaVersion: GALLERY_VERSION,
    exportId: doc.exportId,
    exportedAt: doc.exportedAt,
    part: doc.part,
    totalParts: doc.totalParts,
    evaluatorEmail: profile.email,
    evaluatorName: profile.name,
    items,
  }
}

export function galleryJsonText(doc: ExportDoc): string {
  return JSON.stringify(buildGallery(doc), null, 2)
}
