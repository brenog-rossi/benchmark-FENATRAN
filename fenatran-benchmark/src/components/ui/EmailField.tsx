import { maskEmail } from '../../lib/emailMask'
import { TextField } from './TextField'

type EmailFieldProps = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  label?: string
  name?: string
  hint?: string
}

export function EmailField({
  value,
  onChange,
  onBlur,
  error,
  label = 'E-mail',
  name,
  hint,
}: EmailFieldProps) {
  return (
    <div className="email-field">
      <TextField
        label={label}
        name={name}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(maskEmail(event.target.value))}
        onBlur={onBlur}
        error={error}
        hint={hint}
      />
    </div>
  )
}
