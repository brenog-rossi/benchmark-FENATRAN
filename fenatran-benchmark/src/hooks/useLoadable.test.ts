import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLoadable } from './useLoadable'

describe('useLoadable', () => {
  it('reports a failed read and loads again on retry', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('dexie')).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useLoadable(read))
    expect(result.current.state).toBe('loading')
    await waitFor(() => expect(result.current.state).toBe('failed'))
    const failed = result.current as { retry: () => void }
    act(() => failed.retry())
    expect(result.current.state).toBe('loading')
    await waitFor(() => expect(result.current).toEqual({ state: 'ready', value: 'ok' }))
  })

  it('ignores a failure that arrives after unmount', async () => {
    let reject!: (error: Error) => void
    const read = () => new Promise<string>((_, r) => (reject = r))
    const { result, unmount } = renderHook(() => useLoadable(read))
    unmount()
    reject(new Error('late'))
    await Promise.resolve()
    expect(result.current.state).toBe('loading')
  })
})
