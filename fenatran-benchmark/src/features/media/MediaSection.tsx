import { useState, type ChangeEvent } from 'react'
import { Button, Icon, useToast, type IconName } from '../../components/ui'
import type { Media } from '../../data/types'
import { isRecordingSupported, type Recording } from '../../hooks/useMediaRecorder'
import { MediaGrid } from './MediaGrid'
import { MediaItemSheet } from './MediaItemSheet'
import { PhotoAnnotator } from './PhotoAnnotator'
import type { MediaLibrary, MediaTarget } from './useMediaLibrary'
import { VoiceRecorder } from './VoiceRecorder'

type IdsUpdate = (update: (ids: string[]) => string[]) => void

type MediaSectionProps = {
  label: string
  library: MediaLibrary
  target: MediaTarget
  ids: string[]
  onIdsChange: IdsUpdate
  photosOnly?: boolean
}

type PickerProps = {
  label: string
  icon: IconName
  accept: string
  capture?: 'environment'
  multiple?: boolean
  disabled: boolean
  onFiles: (files: File[]) => void
}

function Picker({ label, icon, accept, capture, multiple, disabled, onFiles }: PickerProps) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 0) onFiles(files)
  }
  return (
    <label className={`btn btn--secondary media-pick${disabled ? ' media-pick--busy' : ''}`}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
      <input
        type="file"
        className="visually-hidden"
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={disabled}
        onChange={change}
      />
    </label>
  )
}

export function MediaSection({
  label,
  library,
  target,
  ids,
  onIdsChange,
  photosOnly = false,
}: MediaSectionProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<{ media: Media; open: boolean }>()
  const [annotating, setAnnotating] = useState<Media>()
  const [recorderOpen, setRecorderOpen] = useState(false)
  const items = ids.flatMap((id) => library.byId.get(id) ?? [])
  const canRecord = isRecordingSupported()

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } catch {
      toast.show('Could not save on this device. Check free storage.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const addFiles = (files: File[]) =>
    run(async () => {
      const result = await library.addFiles(files, target)
      onIdsChange((all) => [...all, ...result.ids])
      if (result.failed > 0) toast.show(`${result.failed} file(s) could not be added.`, 'error')
    })

  const addRecording = (recording: Recording) =>
    run(async () => {
      const id = await library.addRecording(recording.blob, recording.durationSec, target)
      onIdsChange((all) => [...all, id])
    })

  const saveAnnotation = (source: Media, blob: Blob) => {
    setAnnotating(undefined)
    return run(async () => {
      const id = await library.addAnnotated(source, blob)
      onIdsChange((all) => {
        const at = all.indexOf(source.id) + 1
        return [...all.slice(0, at), id, ...all.slice(at)]
      })
      toast.show('Marked-up copy saved', 'success')
    })
  }

  const remove = (media: Media) => {
    setView(undefined)
    return run(async () => {
      await library.remove(media)
      onIdsChange((all) => all.filter((id) => id !== media.id))
    })
  }

  return (
    <section className="media" aria-label={label}>
      <span className="label">{label}</span>
      <MediaGrid items={items} onOpen={(media) => setView({ media, open: true })} />
      <div className="media__actions">
        <Picker
          label="Camera"
          icon="photo_camera"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onFiles={(files) => void addFiles(files)}
        />
        <Picker
          label="Gallery"
          icon="photo_library"
          accept={photosOnly ? 'image/*' : 'image/*,video/*'}
          multiple
          disabled={busy}
          onFiles={(files) => void addFiles(files)}
        />
        {!photosOnly && (
          <Picker
            label="Video"
            icon="videocam"
            accept="video/*"
            capture="environment"
            disabled={busy}
            onFiles={(files) => void addFiles(files)}
          />
        )}
        {!photosOnly &&
          (canRecord ? (
            <Button
              variant="secondary"
              icon="mic"
              className="media-pick"
              disabled={busy}
              onClick={() => setRecorderOpen(true)}
            >
              Voice note
            </Button>
          ) : (
            <Picker
              label="Voice note"
              icon="mic"
              accept="audio/*"
              disabled={busy}
              onFiles={(files) => void addFiles(files)}
            />
          ))}
      </div>
      {busy && (
        <p className="media__busy" role="status">
          Saving media...
        </p>
      )}
      {view && (
        <MediaItemSheet
          media={view.media}
          open={view.open}
          onClose={() => setView({ media: view.media, open: false })}
          onCaption={(media, caption) => void library.updateCaption(media.id, caption)}
          onRemove={(media) => void remove(media)}
          onMarkUp={(media) => {
            setView(undefined)
            setAnnotating(media)
          }}
        />
      )}
      {annotating && (
        <PhotoAnnotator
          photo={annotating}
          onCancel={() => setAnnotating(undefined)}
          onSave={(blob) => void saveAnnotation(annotating, blob)}
        />
      )}
      {canRecord && (
        <VoiceRecorder
          open={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          onRecorded={(recording) => void addRecording(recording)}
          onFile={(file) => void addFiles([file])}
        />
      )}
    </section>
  )
}
