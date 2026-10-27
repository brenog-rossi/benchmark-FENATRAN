import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mediaRepository } from '../data/repositories/media'
import { useStorageEstimate } from './useStorageEstimate'

function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, configurable: true })
}

beforeEach(() => {
  vi.spyOn(mediaRepository, 'totalBytes').mockResolvedValue(1234)
})

afterEach(() => {
  vi.restoreAllMocks()
  setStorage(undefined)
})

describe('useStorageEstimate', () => {
  it('returns media bytes with usage and quota when estimate is available', async () => {
    setStorage({ estimate: vi.fn().mockResolvedValue({ usage: 10, quota: 100 }) })
    const { result } = renderHook(() => useStorageEstimate())
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toEqual({ mediaBytes: 1234, usage: 10, quota: 100 }))
  })

  it('returns only media bytes without navigator.storage', async () => {
    setStorage(undefined)
    const { result } = renderHook(() => useStorageEstimate())
    await waitFor(() =>
      expect(result.current).toEqual({ mediaBytes: 1234, usage: undefined, quota: undefined }),
    )
  })

  it('returns only media bytes when storage has no estimate function', async () => {
    setStorage({})
    const { result } = renderHook(() => useStorageEstimate())
    await waitFor(() =>
      expect(result.current).toEqual({ mediaBytes: 1234, usage: undefined, quota: undefined }),
    )
  })

  it('returns only media bytes when estimate throws', async () => {
    setStorage({ estimate: vi.fn().mockRejectedValue(new Error('denied')) })
    const { result } = renderHook(() => useStorageEstimate())
    await waitFor(() => expect(result.current).toEqual({ mediaBytes: 1234 }))
  })

  it('re-reads when refreshKey changes', async () => {
    const estimate = vi.fn().mockResolvedValue({ usage: 1, quota: 2 })
    setStorage({ estimate })
    const { result, rerender } = renderHook(({ key }) => useStorageEstimate(key), {
      initialProps: { key: 'a' },
    })
    await waitFor(() => expect(result.current?.usage).toBe(1))
    estimate.mockResolvedValue({ usage: 5, quota: 10 })
    rerender({ key: 'a' })
    rerender({ key: 'b' })
    await waitFor(() => expect(result.current).toEqual({ mediaBytes: 1234, usage: 5, quota: 10 }))
    expect(estimate).toHaveBeenCalledTimes(2)
  })

  it('ignores a result that arrives after unmount', async () => {
    let resolve: (value: number) => void = () => {}
    vi.mocked(mediaRepository.totalBytes).mockReturnValue(
      new Promise<number>((r) => {
        resolve = r
      }),
    )
    const { result, unmount } = renderHook(() => useStorageEstimate())
    unmount()
    resolve(1)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBeUndefined()
  })
})
