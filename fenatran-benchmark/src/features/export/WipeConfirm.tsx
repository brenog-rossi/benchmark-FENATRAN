import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, useToast } from '../../components/ui'
import { useEvaluations } from '../../hooks/useEvaluations'
import { wipeEvaluations } from './exporter'

type WipeConfirmProps = { open: boolean; onClose: () => void }

export function WipeConfirm({ open, onClose }: WipeConfirmProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const reload = useEvaluations((state) => state.load)
  const [busy, setBusy] = useState(false)

  const wipe = async () => {
    setBusy(true)
    try {
      await wipeEvaluations()
      await reload()
      toast.show('Evaluations deleted from this device. Your profile is kept.', 'success')
      void navigate('/', { replace: true })
    } catch {
      toast.show('Could not delete the evaluations on this device.', 'error')
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      title="Delete evaluations from this device?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" icon="delete" onClick={() => void wipe()} disabled={busy}>
            Delete evaluations
          </Button>
        </>
      }
    >
      <p>
        Only do this after the ZIP file(s) arrived in the WhatsApp group. All evaluations, photos,
        videos and voice notes are removed from this device. Your profile is kept.
      </p>
    </Dialog>
  )
}
