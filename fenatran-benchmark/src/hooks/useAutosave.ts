import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// Debounced save of `value` whenever it changes (by reference). Pending changes are flushed on
// unmount; call `cancel()` before deleting the record so nothing is written back.
export function useAutosave<T>(value: T, save: (value: T) => Promise<unknown>, delay = 600) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const saveRef = useRef(save)
  const lastValue = useRef(value)
  const pending = useRef<{ value: T } | null>(null)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const flush = useCallback(async () => {
    const next = pending.current
    if (!next) return
    pending.current = null
    setStatus('saving')
    try {
      await saveRef.current(next.value)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [])

  const cancel = useCallback(() => {
    pending.current = null
  }, [])

  useEffect(() => {
    if (value === lastValue.current) return
    lastValue.current = value
    pending.current = { value }
    const timer = setTimeout(() => void flush(), delay)
    return () => clearTimeout(timer)
  }, [value, delay, flush])

  useEffect(() => () => void flush(), [flush])

  return { status, flush, cancel }
}
