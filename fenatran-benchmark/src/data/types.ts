// `name` is optional: empty string when the evaluator leaves it blank.
export type Profile = {
  name: string
  email: string
}

export type Score = 0 | 1 | 2 | 3 | 4 | 5

export type FeatureAnswer = { score: Score | null; comment: string; mediaIds: string[] }

export type TruckEvaluation = {
  brand: string
  brandOther?: string
  model: string
  brochureMediaIds: string[]
  features: Record<string, FeatureAnswer>
}

export type ComponentEvaluation = {
  name: string
  manufacturer: string
  mediaIds: string[]
  comments: string
}

export type Evaluation = {
  id: string
  kind: 'truck' | 'component'
  status: 'draft' | 'finalized'
  createdAt: string
  updatedAt: string
  finalizedAt?: string
  truck?: TruckEvaluation
  component?: ComponentEvaluation
}

export type MediaRole = 'brochure' | 'feature' | 'component'
export type MediaType = 'photo' | 'video' | 'audio'

export type Media = {
  id: string
  evaluationId: string
  featureId?: string
  role: MediaRole
  type: MediaType
  mime: string
  blob: Blob
  // Small JPEG preview for lists (photos only; not exported).
  thumb?: Blob
  caption: string
  durationSec?: number
  annotatedFromId?: string
  createdAt: string
}

export type StoredProfile = Profile & { id: 'profile' }
