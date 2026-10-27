import { useState } from 'react'
import { Button, Sheet, TextArea } from '../../components/ui'
import type { Media } from '../../data/types'
import { objectUrl } from '../../lib/objectUrl'
import { TYPE_LABEL } from './MediaGrid'

type MediaItemSheetProps = {
  media: Media
  open: boolean
  onClose: () => void
  onCaption: (media: Media, caption: string) => void
  onRemove: (media: Media) => void
  onMarkUp: (media: Media) => void
}

// Preview + observation (caption) editor. Closing the sheet in any way keeps the typed caption.
export function MediaItemSheet({
  media,
  open,
  onClose,
  onCaption,
  onRemove,
  onMarkUp,
}: MediaItemSheetProps) {
  const [draft, setDraft] = useState<{ id: string; text: string }>()
  const caption = draft?.id === media.id ? draft.text : media.caption
  const url = objectUrl(media.blob)

  const commit = () => {
    if (caption !== media.caption) onCaption(media, caption)
    setDraft(undefined)
  }
  const close = () => {
    commit()
    onClose()
  }

  return (
    <Sheet open={open} title={TYPE_LABEL[media.type]} onClose={close}>
      <div className="media-view">
        {media.type === 'photo' && <img src={url} alt={caption || 'Photo'} />}
        {media.type === 'video' && <video src={url} controls playsInline />}
        {media.type === 'audio' && <audio src={url} controls />}
      </div>
      <TextArea
        label="Observation"
        placeholder="What does this show? Used as the caption in the gallery."
        value={caption}
        onChange={(event) => setDraft({ id: media.id, text: event.target.value })}
        maxLength={500}
      />
      <div className="media-view__actions">
        {media.type === 'photo' && (
          <Button
            variant="secondary"
            icon="draw"
            onClick={() => {
              commit()
              onMarkUp(media)
            }}
          >
            Mark up
          </Button>
        )}
        <Button variant="danger" icon="delete" onClick={() => onRemove(media)}>
          Remove
        </Button>
        <Button icon="check" onClick={close}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}
