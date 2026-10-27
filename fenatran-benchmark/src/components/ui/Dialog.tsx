import type { ReactNode } from 'react'
import { Overlay } from './Overlay'

type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}

export function Dialog(props: DialogProps) {
  return <Overlay kind="dialog" {...props} />
}
