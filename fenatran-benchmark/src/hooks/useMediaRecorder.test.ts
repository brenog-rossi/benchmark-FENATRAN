import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isRecordingSupported, useMediaRecorder } from './useMediaRecorder'

class FakeRecorder {
  static instances: FakeRecorder[] = []
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = ''
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start = vi.fn(() => {
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    if (this.state !== 'recording') return
    this.state = 'inactive'
    this.onstop?.()
  })
  stream: unknown
  constructor(stream: unknown) {
    this.stream = stream
    FakeRecorder.instances.push(this)
  }
}

const track = { stop: vi.fn() }
const stream = { getTracks: () => [track] }
let getUserMedia: ReturnType<typeof vi.fn>

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeRecorder.instances = []
  track.stop.mockClear()
  getUserMedia = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  setMediaDevices({ getUserMedia })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setMediaDevices(undefined)
})

describe('isRecordingSupported', () => {
  it('is true with MediaRecorder and getUserMedia', () => {
    expect(isRecordingSupported()).toBe(true)
  })

  it('is false without MediaRecorder', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(isRecordingSupported()).toBe(false)
  })

  it('is false without mediaDevices or getUserMedia', () => {
    setMediaDevices(undefined)
    expect(isRecordingSupported()).toBe(false)
    setMediaDevices({})
    expect(isRecordingSupported()).toBe(false)
  })
})

describe('useMediaRecorder', () => {
  it('records, tracks elapsed time and returns the blob and duration on stop', async () => {
    const { result } = renderHook(() => useMediaRecorder())
    expect(result.current.recording).toBe(false)
    await act(() => result.current.start())
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    const recorder = FakeRecorder.instances[0]!
    expect(recorder.stream).toBe(stream)
    expect(recorder.start).toHaveBeenCalled()
    expect(result.current.recording).toBe(true)
    expect(result.current.elapsed).toBe(0)

    await act(() => vi.advanceTimersByTimeAsync(2500))
    expect(result.current.elapsed).toBe(2)

    recorder.ondataavailable?.({ data: new Blob(['abc']) })
    recorder.ondataavailable?.({ data: new Blob([]) })
    recorder.mimeType = 'audio/ogg'

    let recording: Awaited<ReturnType<typeof result.current.stop>> = null
    await act(async () => {
      recording = await result.current.stop()
    })
    expect(recording).not.toBeNull()
    const { blob, durationSec } = recording as unknown as { blob: Blob; durationSec: number }
    expect(blob.type).toBe('audio/ogg')
    expect(blob.size).toBe(3)
    expect(durationSec).toBe(3)
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.recording).toBe(false)

    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(result.current.elapsed).toBe(2)
  })

  it('defaults the blob type to audio/webm', async () => {
    const { result } = renderHook(() => useMediaRecorder())
    await act(() => result.current.start())
    let recording: Awaited<ReturnType<typeof result.current.stop>> = null
    await act(async () => {
      recording = await result.current.stop()
    })
    expect((recording as unknown as { blob: Blob }).blob.type).toBe('audio/webm')
  })

  it('stop without a session resolves null', async () => {
    const { result } = renderHook(() => useMediaRecorder())
    await expect(result.current.stop()).resolves.toBeNull()
  })

  it('cancel stops the recorder and releases the stream', async () => {
    const { result } = renderHook(() => useMediaRecorder())
    await act(() => result.current.start())
    const recorder = FakeRecorder.instances[0]!
    act(() => result.current.cancel())
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(recorder.state).toBe('inactive')
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.recording).toBe(false)
    await expect(result.current.stop()).resolves.toBeNull()
  })

  it('cancel without a session is a no-op', () => {
    const { result } = renderHook(() => useMediaRecorder())
    act(() => result.current.cancel())
    expect(result.current.recording).toBe(false)
  })

  it('releases the recorder on unmount', async () => {
    const { result, unmount } = renderHook(() => useMediaRecorder())
    await act(() => result.current.start())
    unmount()
    expect(FakeRecorder.instances[0]!.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('reports an error when the microphone is denied and clears it on retry', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('denied'))
    const { result } = renderHook(() => useMediaRecorder())
    await act(() => result.current.start())
    expect(result.current.error).toBe(
      'Microphone not available. Allow microphone access or attach an audio file.',
    )
    expect(result.current.recording).toBe(false)
    await act(() => result.current.start())
    expect(result.current.error).toBeUndefined()
    expect(result.current.recording).toBe(true)
  })
})
