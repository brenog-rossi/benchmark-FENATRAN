import writeXlsxFile, { type Row, type Sheet } from 'write-excel-file/browser'
import { FEATURES } from '../../../config/questionnaire'
import type { Evaluation } from '../../../data/types'
import { brandLabel, evaluationTitle, scoredCount } from '../../../lib/evaluation'
import { mediaEntries } from './json'
import type { ExportDoc } from './model'

const header = (titles: string[]): Row =>
  titles.map((value) => ({ value, fontWeight: 'bold' as const }))

const orEmpty = (value: string | number | null | undefined) => value ?? null

function evaluationRow(doc: ExportDoc, evaluation: Evaluation, no: number): Row {
  const truck = evaluation.truck
  const component = evaluation.component
  return [
    no,
    evaluation.kind,
    evaluation.status,
    evaluationTitle(evaluation),
    truck ? brandLabel(truck.brand, truck.brandOther) : null,
    orEmpty(truck?.model),
    truck ? scoredCount(evaluation) : null,
    orEmpty(component?.name),
    orEmpty(component?.manufacturer),
    orEmpty(component?.comments),
    mediaEntries(doc, evaluation.id).length,
    evaluation.createdAt,
    evaluation.updatedAt,
    orEmpty(evaluation.finalizedAt),
    evaluation.id,
  ]
}

export function buildSheets(doc: ExportDoc): Sheet<Blob>[] {
  const { evaluations } = doc.source
  const evaluationsData: Row[] = [
    header([
      'No',
      'Kind',
      'Status',
      'Title',
      'Brand',
      'Model',
      'Features scored',
      'Component',
      'Manufacturer',
      'Comments',
      'Media',
      'Created',
      'Updated',
      'Finalized',
      'Id',
    ]),
  ]
  const scoresData: Row[] = [
    header([
      'No',
      'Evaluation',
      'Feature no',
      'Feature id',
      'Feature',
      'Score',
      'Comment',
      'Media',
    ]),
  ]
  const mediaData: Row[] = [
    header([
      'No',
      'Evaluation',
      'Type',
      'Role',
      'Feature',
      'Caption',
      'File',
      'Part',
      'Duration (s)',
      'Id',
    ]),
  ]

  evaluations.forEach((evaluation, index) => {
    const no = index + 1
    const title = evaluationTitle(evaluation)
    const media = mediaEntries(doc, evaluation.id)
    evaluationsData.push(evaluationRow(doc, evaluation, no))
    if (evaluation.truck) {
      const features = evaluation.truck.features
      FEATURES.forEach((feature, featureIndex) => {
        const answer = features[feature.id]
        scoresData.push([
          no,
          title,
          featureIndex + 1,
          feature.id,
          feature.title,
          orEmpty(answer?.score),
          orEmpty(answer?.comment),
          media.filter((m) => m.featureId === feature.id).length,
        ])
      })
    }
    for (const entry of media) {
      mediaData.push([
        no,
        title,
        entry.type,
        entry.role,
        entry.featureId,
        entry.caption,
        entry.file ?? 'not included',
        entry.part,
        entry.durationSec,
        entry.id,
      ])
    }
  })

  return [
    { sheet: 'Evaluations', data: evaluationsData, stickyRowsCount: 1 },
    { sheet: 'Feature scores', data: scoresData, stickyRowsCount: 1 },
    { sheet: 'Media', data: mediaData, stickyRowsCount: 1 },
  ]
}

export function buildExcel(doc: ExportDoc): Promise<Blob> {
  return writeXlsxFile(buildSheets(doc)).toBlob()
}
