import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type EmptyStateProps = { title: string; text?: string; icon?: IconName; action?: ReactNode }

export function EmptyState({ title, text, icon = 'inbox', action }: EmptyStateProps) {
  return (
    <div className="empty">
      <Icon name={icon} size={48} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
