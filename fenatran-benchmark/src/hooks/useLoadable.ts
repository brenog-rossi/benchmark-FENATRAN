import { useEffect, useState } from 'react'

export type Loadable<T> =
  { state: 'loading' } | { state: 'failed'; retry: () => void } | { state: 'ready'; value: T }

type Result<T> = { read: () => Promise<T>; attempt: number } & (
  { failed: true } | { failed: false; value: T }
)

// Runs `read` (keep it stable with useCallback) and reports a failure instead of loading forever.
export function useLoadable<T>(read: () => Promise<T>): Loadable<T> {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T>>()

  useEffect(() => {
    let active = true
    read().then(
      (value) => {
        if (active) setResult({ read, attempt, failed: false, value })
      },
      () => {
        if (active) setResult({ read, attempt, failed: true })
      },
    )
    return () => {
      active = false
    }
  }, [read, attempt])

  if (result?.read !== read || result.attempt !== attempt) return { state: 'loading' }
  if (result.failed) return { state: 'failed', retry: () => setAttempt(attempt + 1) }
  return { state: 'ready', value: result.value }
}
