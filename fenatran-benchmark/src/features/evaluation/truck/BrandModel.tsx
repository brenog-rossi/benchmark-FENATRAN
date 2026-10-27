import { Select, TextField } from '../../../components/ui'
import { BRANDS, OTHER } from '../../../config/questionnaire'
import type { TruckEvaluation } from '../../../data/types'
import type { RequiredErrors } from '../schema'

type BrandModelProps = {
  truck: TruckEvaluation
  errors: RequiredErrors
  onChange: (patch: Partial<TruckEvaluation>) => void
}

export function BrandModel({ truck, errors, onChange }: BrandModelProps) {
  return (
    <div className="eval__fields">
      <Select
        label="Brand"
        options={BRANDS}
        placeholder="Choose the brand"
        value={truck.brand}
        error={errors.brand}
        onChange={(event) =>
          onChange(
            event.target.value === OTHER
              ? { brand: OTHER }
              : { brand: event.target.value, brandOther: undefined },
          )
        }
      />
      {truck.brand === OTHER && (
        <TextField
          label="Brand name"
          value={truck.brandOther ?? ''}
          error={errors.brandOther}
          maxLength={80}
          onChange={(event) => onChange({ brandOther: event.target.value })}
        />
      )}
      <TextField
        label="Model"
        placeholder="For example FH 540 6x4"
        value={truck.model}
        error={errors.model}
        maxLength={120}
        onChange={(event) => onChange({ model: event.target.value })}
      />
    </div>
  )
}
