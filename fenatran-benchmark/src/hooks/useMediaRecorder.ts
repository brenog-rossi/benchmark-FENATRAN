import { useCallback, useEffect, useRef, useState } from 'react'

export function isRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export type Recording = { blob: Blob; durationSec: number }
type Session = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; startedAt: number }

export function useMediaRecorder() {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string>()
  const session = useRef<Session | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const release = useCallback(() => {
    clearInterval(timer.current)
    if (session.current?.recorder.state === 'recording') session.current.recorder.stop()
    session.current?.stream.getTracks().forEach((track) => track.stop())
    session.current = null
    setRecording(false)
  }, [])

  const start = useCallback(async () => {
    setError(undefined)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const current: Session = { recorder, stream, chunks: [], startedAt: Date.now() }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) current.chunks.push(event.data)
      }
      session.current = current
      recorder.start()
      setElapsed(0)
      setRecording(true)
      timer.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - current.startedAt) / 1000)),
        500,
      )
    } catch {
      setError('Microphone not available. Allow microphone access or attach an audio file.')
    }
  }, [])

  const stop = useCallback(
    () =>
      new Promise<Recording | null>((resolve) => {
        const current = session.current
        if (!current) return resolve(null)
        current.recorder.onstop = () => {
          const type = current.recorder.mimeType || 'audio/webm'
          resolve({
            blob: new Blob(current.chunks, { type }),
            durationSec: Math.round((Date.now() - current.startedAt) / 1000),
          })
        }
        current.recorder.stop()
        release()
      }),
    [release],
  )

  useEffect(() => release, [release])

  return { recording, elapsed, error, start, stop, cancel: release }
}
