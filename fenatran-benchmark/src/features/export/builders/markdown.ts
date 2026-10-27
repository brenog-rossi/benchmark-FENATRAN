import { FEATURES } from '../../../config/questionnaire'
import type { Evaluation } from '../../../data/types'
import { brandLabel, evaluationTitle, scoredCount } from '../../../lib/evaluation'
import { formatDuration } from '../../../lib/format'
import { mediaEntries, type MediaEntry } from './json'
import type { ExportDoc } from './model'

// Table cells: no pipes or line breaks.
export function cell(text: string): string {
  return (
    text
      .trim()
      .replace(/\|/g, '\\|')
      .replace(/\s*\r?\n\s*/g, ' / ') || '-'
  )
}

function quote(text: string): string {
  const trimmed = text.trim()
  return trimmed ? trimmed.replace(/\r?\n/g, '\n> ').replace(/^/, '> ') : '-'
}

const ROLE_LABEL = { brochure: 'Brochure', feature: 'Feature', component: 'Component' } as const

function mediaLine(entry: MediaEntry): string {
  const where = entry.file ? `\`${entry.file}\`` : '(not included in this export)'
  const extra = entry.durationSec !== null ? `, ${formatDuration(entry.durationSec)}` : ''
  const caption = entry.caption.trim() ? ` - ${cell(entry.caption)}` : ''
  const part = entry.part !== null ? ` (part ${entry.part})` : ''
  return `- ${entry.type}${extra}: ${where}${part}${caption}`
}

function truckSection(evaluation: Evaluation, media: MediaEntry[]): string[] {
  const truck = evaluation.truck as NonNullable<Evaluation['truck']>
  const lines = [
    `- Brand: ${cell(brandLabel(truck.brand, truck.brandOther))}`,
    `- Model: ${cell(truck.model)}`,
    `- Features scored: ${scoredCount(evaluation)} of ${FEATURES.length}`,
    '',
    '| # | Feature | Score | Comment | Media |',
    '|---|---|---|---|---|',
  ]
  FEATURES.forEach((feature, index) => {
    const answer = truck.features[feature.id]
    const count = media.filter((m) => m.featureId === feature.id).length
    lines.push(
      `| ${index + 1} | ${cell(feature.title)} | ${answer?.score ?? '-'} | ${cell(answer?.comment ?? '')} | ${count} |`,
    )
  })
  return lines
}

function componentSection(evaluation: Evaluation): string[] {
  const component = evaluation.component as NonNullable<Evaluation['component']>
  return [
    `- Component: ${cell(component.name)}`,
    `- Manufacturer: ${cell(component.manufacturer)}`,
    '',
    'Comments:',
    '',
    quote(component.comments),
  ]
}

function evaluationSection(doc: ExportDoc, evaluation: Evaluation, no: number): string[] {
  const media = mediaEntries(doc, evaluation.id)
  const kind = evaluation.kind === 'truck' ? 'Truck' : 'Component'
  const lines = [
    `## ${no}. ${kind}: ${evaluationTitle(evaluation)}`,
    '',
    `- Status: ${evaluation.status}`,
    `- Created: ${evaluation.createdAt}`,
    `- Updated: ${evaluation.updatedAt}`,
    ...(evaluation.finalizedAt ? [`- Finalized: ${evaluation.finalizedAt}`] : []),
    ...(evaluation.kind === 'truck'
      ? truckSection(evaluation, media)
      : componentSection(evaluation)),
    '',
    `### Media (${media.length})`,
    '',
  ]
  for (const role of ['brochure', 'feature', 'component'] as const) {
    const items = media.filter((m) => m.role === role)
    if (items.length === 0) continue
    lines.push(`${ROLE_LABEL[role]}:`, '')
    for (const entry of items) {
      const feature = FEATURES.find((f) => f.id === entry.featureId)
      lines.push(feature ? `${mediaLine(entry)} [${feature.title}]` : mediaLine(entry))
    }
    lines.push('')
  }
  if (media.length === 0) lines.push('No media.', '')
  return lines
}

export function buildMarkdown(doc: ExportDoc): string {
  const { profile, evaluations } = doc.source
  const lines = [
    `# FENATRAN 2026 Benchmark - ${profile.name || profile.email}`,
    '',
    `- Exported: ${doc.exportedAt}`,
    `- Part: ${doc.part} of ${doc.totalParts}`,
    `- Photos: original`,
    `- Videos: ${doc.videosIncluded ? 'included' : 'not included'}`,
    `- Evaluator: ${profile.name ? `${profile.name} (${profile.email})` : profile.email}`,
    `- Evaluations: ${evaluations.length}`,
    '',
  ]
  evaluations.forEach((evaluation, index) => {
    lines.push(...evaluationSection(doc, evaluation, index + 1))
  })
  return `${lines.join('\n').trimEnd()}\n`
}

export function buildReadme(doc: ExportDoc): string {
  return [
    'FENATRAN 2026 Benchmark - export',
    '',
    `Evaluator: ${doc.source.profile.name || doc.source.profile.email}`,
    `Exported: ${doc.exportedAt}`,
    `Export id: ${doc.exportId}`,
    `Part ${doc.part} of ${doc.totalParts}`,
    '',
    'Contents',
    '- data.json    All answers and the media list (machine-readable, schema "fenatran-benchmark" v2).',
    '- gallery.json Captioned photos and videos of this part, one flat row each (for the gallery).',
    '- summary.md   Readable summary per evaluation.',
    '- summary.xlsx Sheets: Evaluations, Feature scores, Media.',
    '- media/       Photos, videos and voice notes, one folder per evaluation.',
    '',
    'Every part contains the full data.json. Each media entry tells in which part its file is',
    '("part"); "file": null means the file was left out of this export.',
    '',
  ].join('\r\n')
}
