import { motion } from 'motion/react'
import { useId } from 'react'
import { spring } from '../../design/motion'

type RatingScaleProps = {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
}

// Segmented radio group; choosing the selected value again clears it (null = not scored).
export function RatingScale({
  label,
  value,
  onChange,
  min = 0,
  max = 5,
  minLabel,
  maxLabel,
}: RatingScaleProps) {
  const name = useId()
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <fieldset className="rating">
      <legend className="rating__legend">{label}</legend>
      <div className="rating__options">
        {values.map((n) => (
          <label key={n} className={`rating__option${value === n ? ' rating__option--on' : ''}`}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              onClick={() => {
                if (value === n) onChange(null)
              }}
            />
            {value === n && (
              <motion.span
                className="rating__indicator"
                layoutId={`${name}-on`}
                transition={spring}
              />
            )}
            <span className="rating__text">{n}</span>
          </label>
        ))}
      </div>
      <p className="rating__hint">
        {value === null ? 'Not scored' : `Score ${value}`}
        {minLabel && maxLabel && (
          <span>
            {' '}
            · {min} = {minLabel}, {max} = {maxLabel}
          </span>
        )}
      </p>
    </fieldset>
  )
}
