import { AnimatePresence, motion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { listItem } from '../../design/motion'
import { Icon } from './Icon'

type ToastKind = 'info' | 'success' | 'error'
type ToastItem = { id: number; message: string; kind: ToastKind }
type ToastApi = { show: (message: string, kind?: ToastKind) => void }

const ToastContext = createContext<ToastApi | null>(null)

const TOAST_MS = 4000
let nextId = 1

function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(item.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [item.id, onDone])
  return (
    <motion.div
      className={`toast toast--${item.kind}`}
      variants={listItem}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <Icon
        name={item.kind === 'error' ? 'error' : item.kind === 'success' ? 'check_circle' : 'info'}
        size={20}
      />
      <span>{item.message}</span>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const remove = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])
  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    setItems((all) => [...all, { id: nextId++, message, kind }])
  }, [])
  const api = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((item) => (
            <ToastView key={item.id} item={item} onDone={remove} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
