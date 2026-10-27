import { useEffect, useState } from 'react'
import { mediaRepository } from '../data/repositories/media'

export type StorageEstimate = { mediaBytes: number; usage?: number; quota?: number }

async function estimate(): Promise<StorageEstimate> {
  const mediaBytes = await mediaRepository.totalBytes()
  try {
    const result = await navigator.storage?.estimate?.()
    return { mediaBytes, usage: result?.usage, quota: result?.quota }
  } catch {
    return { mediaBytes }
  }
}

// Re-reads when `refreshKey` changes (for example the evaluation list).
export function useStorageEstimate(refreshKey?: unknown): StorageEstimate | undefined {
  const [value, setValue] = useState<StorageEstimate>()
  useEffect(() => {
    let active = true
    void estimate().then((next) => {
      if (active) setValue(next)
    })
    return () => {
      active = false
    }
  }, [refreshKey])
  return value
}
