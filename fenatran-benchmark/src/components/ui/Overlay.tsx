import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, type ReactNode } from 'react'
import { dialog, fade, sheet } from '../../design/motion'

type OverlayProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
  kind: 'dialog' | 'sheet'
}

export function Overlay({ open, title, onClose, children, actions, kind }: OverlayProps) {
  const titleId = useId()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const panelVariants = reduce ? fade : kind === 'sheet' ? sheet : dialog

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`overlay overlay--${kind}`}
          variants={fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          data-testid="overlay-backdrop"
        >
          <motion.div
            className="overlay__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>{title}</h2>
            <div className="overlay__body">{children}</div>
            {actions && <div className="overlay__actions">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
