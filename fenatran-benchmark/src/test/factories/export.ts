import type { ExportSource } from '../../features/export/builders/model'
import type { Evaluation, FeatureAnswer, Media, Profile } from '../../data/types'

export const profile: Profile = {
  name: 'João da Silva',
  email: 'joao.silva@example.com',
}

const answer = (score: FeatureAnswer['score'], comment = ''): FeatureAnswer => ({
  score,
  comment,
  mediaIds: [],
})

export function truckEvaluation(patch: Partial<Evaluation> = {}): Evaluation {
  return {
    id: 'truck-1',
    kind: 'truck',
    status: 'finalized',
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T11:00:00.000Z',
    finalizedAt: '2026-10-19T11:00:00.000Z',
    truck: {
      brand: 'Other',
      brandOther: 'Tatra',
      model: 'Phoenix',
      brochureMediaIds: ['m-brochure'],
      features: {
        seats: answer(4, 'Good | firm\nlumbar support'),
        bed: answer(0),
        'cab-space': answer(null, 'Not checked'),
      },
    },
    ...patch,
  }
}

export function componentEvaluation(patch: Partial<Evaluation> = {}): Evaluation {
  return {
    id: 'component-1',
    kind: 'component',
    status: 'draft',
    createdAt: '2026-10-19T12:00:00.000Z',
    updatedAt: '2026-10-19T12:30:00.000Z',
    component: {
      name: 'Battery',
      manufacturer: 'Knorr',
      mediaIds: [],
      comments: 'Compact\nGood access',
    },
    ...patch,
  }
}

export function mediaItem(patch: Partial<Media> & Pick<Media, 'id' | 'evaluationId'>): Media {
  return {
    role: 'feature',
    type: 'photo',
    mime: 'image/png',
    blob: new Blob(['p'.repeat(10)], { type: 'image/png' }),
    caption: '',
    createdAt: '2026-10-19T10:30:00.000Z',
    ...patch,
  }
}

export function profileWith(patch: Partial<Profile> = {}): Profile {
  return { ...profile, ...patch }
}

// Blob of exactly `size` bytes without allocating it twice.
export function blobOfSize(size: number, type = 'video/mp4'): Blob {
  return new Blob([new Uint8Array(size)], { type })
}

export function videoItem(id: string, evaluationId: string, size: number, featureId = 'seats') {
  return mediaItem({
    id,
    evaluationId,
    featureId,
    type: 'video',
    mime: 'video/mp4',
    blob: blobOfSize(size),
  })
}

export function sourceWith(patch: Partial<ExportSource> = {}): ExportSource {
  return { profile, evaluations: [], media: [], ...patch }
}

// Truck (HEIC brochure photo, feature photo with caption, video, audio) + component (one photo).
export function exportSource(): ExportSource {
  return {
    profile,
    evaluations: [truckEvaluation(), componentEvaluation()],
    media: [
      mediaItem({
        id: 'm-brochure',
        evaluationId: 'truck-1',
        role: 'brochure',
        mime: 'image/heic',
        blob: new Blob(['h'.repeat(10)], { type: 'image/heic' }),
      }),
      mediaItem({
        id: 'm-seat',
        evaluationId: 'truck-1',
        featureId: 'seats',
        caption: 'Seat belt, ajuste fácil',
      }),
      mediaItem({
        id: 'm-video',
        evaluationId: 'truck-1',
        featureId: 'seats',
        type: 'video',
        mime: 'video/mp4',
        blob: new Blob(['v'.repeat(40)], { type: 'video/mp4' }),
      }),
      mediaItem({
        id: 'm-audio',
        evaluationId: 'truck-1',
        featureId: 'bed',
        type: 'audio',
        mime: 'audio/webm;codecs=opus',
        blob: new Blob(['a'.repeat(5)], { type: 'audio/webm' }),
        durationSec: 75,
      }),
      mediaItem({
        id: 'm-comp',
        evaluationId: 'component-1',
        role: 'component',
        caption: 'Mounting',
        annotatedFromId: 'm-x',
      }),
    ],
  }
}
