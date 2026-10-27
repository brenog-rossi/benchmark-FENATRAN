import { useId, type SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: readonly string[]
  placeholder?: string
  error?: string
}

export function Select({ label, options, placeholder, error, id, ...rest }: SelectProps) {
  const auto = useId()
  const selectId = id ?? auto
  return (
    <div className="field">
      <label htmlFor={selectId} className="field__label">
        {label}
      </label>
      <select
        id={selectId}
        className="field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
