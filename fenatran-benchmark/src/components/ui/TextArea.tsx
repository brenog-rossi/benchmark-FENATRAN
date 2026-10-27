import { useId, type TextareaHTMLAttributes } from 'react'

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }

export function TextArea({ label, error, id, rows = 3, ...rest }: TextAreaProps) {
  const auto = useId()
  const areaId = id ?? auto
  return (
    <div className="field">
      <label htmlFor={areaId} className="field__label">
        {label}
      </label>
      <textarea
        id={areaId}
        rows={rows}
        className="field__control field__control--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${areaId}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
