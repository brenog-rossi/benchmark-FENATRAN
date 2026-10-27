import { z } from '../lib/zod'

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your e-mail')
  .pipe(z.email('Enter a valid e-mail, for example name@company.com'))

const scoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

// Profile form and stored profile: e-mail required, name optional.
export const profileSchema = z.object({
  name: z.string().trim().max(80, 'Use at most 80 characters'),
  email: emailSchema,
})
export type ProfileFormInput = z.input<typeof profileSchema>

export const featureAnswerSchema = z.object({
  score: scoreSchema.nullable(),
  comment: z.string(),
  mediaIds: z.array(z.string()),
})

export const evaluationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['truck', 'component']),
  status: z.enum(['draft', 'finalized']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  finalizedAt: z.iso.datetime().optional(),
  truck: z
    .object({
      brand: z.string(),
      brandOther: z.string().optional(),
      model: z.string(),
      brochureMediaIds: z.array(z.string()),
      features: z.record(z.string(), featureAnswerSchema),
    })
    .optional(),
  component: z
    .object({
      name: z.string(),
      manufacturer: z.string(),
      mediaIds: z.array(z.string()),
      comments: z.string(),
    })
    .optional(),
})

export const mediaSchema = z.object({
  id: z.string().min(1),
  evaluationId: z.string().min(1),
  featureId: z.string().optional(),
  role: z.enum(['brochure', 'feature', 'component']),
  type: z.enum(['photo', 'video', 'audio']),
  mime: z.string(),
  blob: z.instanceof(Blob),
  thumb: z.instanceof(Blob).optional(),
  caption: z.string(),
  durationSec: z.number().nonnegative().optional(),
  annotatedFromId: z.string().optional(),
  createdAt: z.iso.datetime(),
})
