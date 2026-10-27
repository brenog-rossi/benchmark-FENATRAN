import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: IconName
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  icon,
  fullWidth,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, fullWidth ? 'btn--full' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}
