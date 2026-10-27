import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, useToast, type IconName } from '../../components/ui'
import { formatBytes } from '../../lib/format'
import type { ExportResult } from './exporter'
import { canShareFiles, downloadFile, shareFiles, type ShareOutcome } from './share'
import { WipeConfirm } from './WipeConfirm'

type ShareStepProps = { result: ExportResult }

export function ShareStep({ result }: ShareStepProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set())
  const [wipeOpen, setWipeOpen] = useState(false)
  const { zips } = result

  const status = (key: string, icon: IconName) =>
    sent.has(key) ? { name: 'check_circle' as const, label: 'Sent' } : { name: icon }

  const mark = (key: string) => setSent((all) => new Set(all).add(key))

  const handle = (key: string, outcome: ShareOutcome) => {
    if (outcome === 'shared') mark(key)
    else if (outcome === 'failed')
      toast.show('Sharing did not work. Use Download instead.', 'error')
  }

  const shareZip = async (file: File, index: number) => {
    const text =
      zips.length > 1 ? `FENATRAN 2026 - part ${index + 1} of ${zips.length}` : 'FENATRAN 2026'
    handle(file.name, await shareFiles([file], file.name, text))
  }

  const download = (files: File[], key: string) => {
    files.forEach(downloadFile)
    mark(key)
  }

  return (
    <div className="eval export">
      <header className="eval__head">
        <span className="label">Export</span>
        <h1>Send to the WhatsApp group</h1>
        <p>
          Share each ZIP file to the group. It keeps the photos in original quality. If sharing is
          not available, download the file and attach it in WhatsApp as a document.
        </p>
      </header>

      <section className="eval__section" aria-labelledby="zip-title">
        <h2 id="zip-title">1. ZIP {zips.length > 1 ? `files (${zips.length})` : 'file'}</h2>
        <ul className="export__files">
          {zips.map((file, index) => (
            <li key={file.name} className="export__file">
              <Icon {...status(file.name, 'folder_zip')} />
              <span className="export__name">
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)}</span>
              </span>
              <span className="export__actions">
                {canShareFiles([file]) && (
                  <Button icon="share" onClick={() => void shareZip(file, index)}>
                    Share
                  </Button>
                )}
                <Button
                  variant="secondary"
                  icon="download"
                  aria-label={`Download ${file.name}`}
                  onClick={() => download([file], file.name)}
                >
                  Download
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="eval__section" aria-labelledby="done-title">
        <h2 id="done-title">2. Clean up</h2>
        <p className="eval__intro">
          When everything arrived in the group, delete the evaluations from this device. Your
          profile is kept for the next day.
        </p>
      </section>

      <div className="actionbar">
        <Button variant="secondary" icon="arrow_back" onClick={() => void navigate('/')}>
          Back to home
        </Button>
        <Button icon="check" onClick={() => setWipeOpen(true)}>
          I sent everything
        </Button>
      </div>

      <WipeConfirm open={wipeOpen} onClose={() => setWipeOpen(false)} />
    </div>
  )
}
