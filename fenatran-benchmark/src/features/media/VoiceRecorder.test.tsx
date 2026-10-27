import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recording } from '../../hooks/useMediaRecorder'
import { VoiceRecorder } from './VoiceRecorder'

const recorder = vi.hoisted(() => ({
  recording: false,
  elapsed: 0,
  error: undefined as string | undefined,
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('../../hooks/useMediaRecorder', () => ({ useMediaRecorder: () => recorder }))

function setup() {
  const props = { onClose: vi.fn(), onRecorded: vi.fn(), onFile: vi.fn() }
  render(<VoiceRecorder open {...props} />)
  return props
}

beforeEach(() => {
  recorder.recording = false
  recorder.elapsed = 0
  recorder.error = undefined
  recorder.start.mockReset().mockResolvedValue(undefined)
  recorder.stop.mockReset()
  recorder.cancel.mockReset()
})

describe('VoiceRecorder', () => {
  it('starts recording when ready', async () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Voice note' })).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('0:00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    expect(recorder.start).toHaveBeenCalledOnce()
  })

  it('stops, saves the recording and closes', async () => {
    recorder.recording = true
    recorder.elapsed = 75
    const recording: Recording = { blob: new Blob(['a']), durationSec: 75 }
    recorder.stop.mockResolvedValue(recording)
    const props = setup()
    expect(screen.getByText('Recording...')).toBeInTheDocument()
    expect(screen.getByText('1:15')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Stop and save' }))
    expect(props.onRecorded).toHaveBeenCalledWith(recording)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('closes without saving when nothing was recorded', async () => {
    recorder.recording = true
    recorder.stop.mockResolvedValue(null)
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Stop and save' }))
    expect(props.onRecorded).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('cancels the recording', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(recorder.cancel).toHaveBeenCalledOnce()
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('offers an audio file when the microphone fails', async () => {
    recorder.error = 'Microphone not available.'
    const props = setup()
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone not available.')
    const input = screen.getByLabelText('Attach audio file')

    fireEvent.change(input, { target: { files: [] } })
    expect(props.onFile).not.toHaveBeenCalled()

    const file = new File(['a'], 'note.m4a', { type: 'audio/mp4' })
    await userEvent.upload(input, file)
    expect(props.onFile).toHaveBeenCalledWith(file)
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
