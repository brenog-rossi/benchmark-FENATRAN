import { OTHER } from '../../config/questionnaire'
import type { Evaluation } from '../../data/types'
import { z } from '../../lib/zod'

const required = (message: string) => z.string().trim().min(1, message)

const truckRequired = z
  .object({
    brand: required('Choose the brand'),
    brandOther: z.string().optional(),
    model: required('Enter the model'),
  })
  .refine((t) => t.brand !== OTHER || (t.brandOther ?? '').trim() !== '', {
    message: 'Enter the brand name',
    path: ['brandOther'],
    when: () => true,
  })

const componentRequired = z.object({ name: required('Enter the component name') })

export type RequiredErrors = Partial<Record<'brand' | 'brandOther' | 'model' | 'name', string>>

// Mandatory fields for Finalize (truck: brand + model, component: name). Drafts may be empty.
export function requiredErrors(evaluation: Evaluation): RequiredErrors {
  const result =
    evaluation.kind === 'truck'
      ? truckRequired.safeParse(evaluation.truck ?? {})
      : componentRequired.safeParse(evaluation.component ?? {})
  const errors: RequiredErrors = {}
  for (const issue of result.error?.issues ?? []) {
    errors[issue.path[0] as keyof RequiredErrors] = issue.message
  }
  return errors
}
