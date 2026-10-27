import { Button, Dialog } from '../../components/ui'
import { formatBytes } from '../../lib/format'

type BigZipDialogProps = {
  open: boolean
  bytes: number
  limit: number
  canDropVideos: boolean
  onSplit: () => void
  onWithoutVideos: () => void
  onBack: () => void
}

export function BigZipDialog(props: BigZipDialogProps) {
  const { open, bytes, limit, canDropVideos, onSplit, onWithoutVideos, onBack } = props
  return (
    <Dialog
      open={open}
      title="The export is too big for WhatsApp"
      onClose={onBack}
      actions={
        <>
          <Button variant="secondary" onClick={onBack}>
            Go back
          </Button>
          {canDropVideos && (
            <Button variant="secondary" icon="videocam" onClick={onWithoutVideos}>
              Export without videos
            </Button>
          )}
          <Button icon="folder_zip" onClick={onSplit}>
            Split into parts
          </Button>
        </>
      }
    >
      <p>
        The ZIP would be about {formatBytes(bytes)}. WhatsApp accepts files up to{' '}
        {formatBytes(limit)}.
      </p>
      <ul className="export__list">
        <li>Split into parts: several ZIP files, each with data.json and its share of media.</li>
        {canDropVideos && <li>Export without videos: photos and voice notes only.</li>}
        <li>Go back: change the photo quality or delete media first.</li>
      </ul>
    </Dialog>
  )
}
