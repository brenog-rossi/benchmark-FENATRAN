import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from './useAutosave'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

type Props = { value: { n: number }; save: (value: { n: number }) => Promise<unknown> }

function setup(initial: { n: number }, save: Props['save'], delay?: number) {
  return renderHook(({ value, save }: Props) => useAutosave(value, save, delay), {
    initialProps: { value: initial, save },
  })
}

describe('useAutosave', () => {
  it('starts idle and does not save the initial value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = setup({ n: 1 }, save)
    expect(result.current.status).toBe('idle')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(save).not.toHaveBeenCalled()
    await act(() => result.current.flush())
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('debounces saves and reports saving then saved', async () => {
    let resolve: () => void = () => {}
    const save = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    )
    const first = { n: 1 }
    const { result, rerender } = setup(first, save, 300)
    rerender({ value: { n: 2 }, save })
    const latest = { n: 3 }
    rerender({ value: latest, save })
    await act(() => vi.advanceTimersByTimeAsync(299))
    expect(save).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(latest)
    expect(result.current.status).toBe('saving')
    await act(async () => resolve())
    expect(result.current.status).toBe('saved')
  })

  it('skips saving when re-rendered with the same value reference', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const value = { n: 1 }
    const { rerender } = setup(value, save)
    rerender({ value, save })
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(save).not.toHaveBeenCalled()
  })

  it('reports error when save rejects', async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'))
    const { result, rerender } = setup({ n: 1 }, save)
    rerender({ value: { n: 2 }, save })
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(result.current.status).toBe('error')
  })

  it('flushes immediately and uses the latest save function', async () => {
    const oldSave = vi.fn().mockResolvedValue(undefined)
    const newSave = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = setup({ n: 1 }, oldSave)
    const next = { n: 2 }
    rerender({ value: next, save: newSave })
    await act(() => result.current.flush())
    expect(oldSave).not.toHaveBeenCalled()
    expect(newSave).toHaveBeenCalledWith(next)
    expect(result.current.status).toBe('saved')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(newSave).toHaveBeenCalledTimes(1)
  })

  it('cancel drops the pending change', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender, unmount } = setup({ n: 1 }, save)
    rerender({ value: { n: 2 }, save })
    act(() => result.current.cancel())
    await act(() => vi.advanceTimersByTimeAsync(1000))
    unmount()
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('flushes pending changes on unmount', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = setup({ n: 1 }, save)
    const next = { n: 2 }
    rerender({ value: next, save })
    unmount()
    expect(save).toHaveBeenCalledWith(next)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(save).toHaveBeenCalledTimes(1)
  })
})
