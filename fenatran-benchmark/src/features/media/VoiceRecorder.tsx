import { Button, Icon, Sheet } from '../../components/ui'
import { useMediaRecorder, type Recording } from '../../hooks/useMediaRecorder'
import { formatDuration } from '../../lib/format'

type VoiceRecorderProps = {
  open: boolean
  onClose: () => void
  onRecorded: (recording: Recording) => void
  onFile: (file: File) => void
}

export function VoiceRecorder({ open, onClose, onRecorded, onFile }: VoiceRecorderProps) {
  const recorder = useMediaRecorder()

  const cancel = () => {
    recorder.cancel()
    onClose()
  }
  const stop = async () => {
    const result = await recorder.stop()
    if (result) onRecorded(result)
    onClose()
  }

  return (
    <Sheet
      open={open}
      title="Voice note"
      onClose={cancel}
      actions={
        <>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          {recorder.recording ? (
            <Button icon="stop_circle" onClick={() => void stop()}>
              Stop and save
            </Button>
          ) : (
            <Button icon="mic" onClick={() => void recorder.start()}>
              Start recording
            </Button>
          )}
        </>
      }
    >
      <div className="recorder" aria-live="polite">
        <span className="recorder__time">{formatDuration(recorder.elapsed)}</span>
        <span>{recorder.recording ? 'Recording...' : 'Ready'}</span>
      </div>
      {recorder.error && (
        <>
          <p className="field__error" role="alert">
            {recorder.error}
          </p>
          <label className="btn btn--secondary">
            <Icon name="mic" size={20} />
            Attach audio file
            <input
              type="file"
              accept="audio/*"
              className="visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  onFile(file)
                  onClose()
                }
              }}
            />
          </label>
        </>
      )}
    </Sheet>
  )
}
