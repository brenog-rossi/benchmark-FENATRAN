import type { ReactNode } from 'react'
import { Overlay } from './Overlay'

type SheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}

export function Sheet(props: SheetProps) {
  return <Overlay kind="sheet" {...props} />
}
