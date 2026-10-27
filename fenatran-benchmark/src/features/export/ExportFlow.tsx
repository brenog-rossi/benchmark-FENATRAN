import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, Progress, ReadError, useToast } from '../../components/ui'
import type { MediaType } from '../../data/types'
import { useLoadable } from '../../hooks/useLoadable'
import { formatBytes, plural } from '../../lib/format'
import { BigZipDialog } from './BigZipDialog'
import { prepareMedia, type ExportFile } from './builders/model'
import {
  buildExport,
  estimateBytes,
  loadExportSource,
  ZIP_LIMIT,
  type ExportResult,
} from './exporter'
import { ShareStep } from './ShareStep'

type Stage =
  | { name: 'options' }
  | { name: 'preparing'; done: number; total: number }
  | { name: 'big'; files: ExportFile[]; bytes: number; includeVideos: boolean }
  | { name: 'building' }
  | { name: 'ready'; result: ExportResult }

type ExportFlowProps = { limit?: number }

export function ExportFlow({ limit = ZIP_LIMIT }: ExportFlowProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const read = useLoadable(loadExportSource)
  const [stage, setStage] = useState<Stage>({ name: 'options' })

  if (read.state === 'loading') return <p className="eval__loading">Loading...</p>
  if (read.state === 'failed') return <ReadError onRetry={read.retry} />
  const source = read.value
  if (source === null || source.evaluations.length === 0) {
    return (
      <EmptyState
        title="Nothing to export"
        text="There are no evaluations on this device."
        action={<Button onClick={() => void navigate('/')}>Back to home</Button>}
      />
    )
  }
  const loaded = source

  const fail = () => {
    toast.show('The export could not be created on this device.', 'error')
    setStage({ name: 'options' })
  }

  const build = async (files: ExportFile[], includeVideos: boolean, split: boolean) => {
    setStage({ name: 'building' })
    try {
      const options = { includeVideos, split, limit } as const
      setStage({ name: 'ready', result: await buildExport(loaded, files, options) })
    } catch {
      fail()
    }
  }

  const decide = (files: ExportFile[], includeVideos: boolean) => {
    const bytes = estimateBytes(files, includeVideos)
    if (bytes > limit) setStage({ name: 'big', files, bytes, includeVideos })
    else void build(files, includeVideos, false)
  }

  const start = async () => {
    setStage({ name: 'preparing', done: 0, total: loaded.media.length })
    try {
      const files = await prepareMedia(loaded, (done, total) =>
        setStage({ name: 'preparing', done, total }),
      )
      decide(files, true)
    } catch {
      fail()
    }
  }

  if (stage.name === 'ready') {
    return <ShareStep result={stage.result} />
  }

  const count = (type: MediaType) => loaded.media.filter((m) => m.type === type).length
  const drafts = loaded.evaluations.filter((e) => e.status === 'draft').length
  const bytes = loaded.media.reduce((sum, m) => sum + m.blob.size, 0)
  const working = stage.name === 'preparing' || stage.name === 'building'

  return (
    <div className="eval export">
      <header className="eval__head">
        <span className="label">Export</span>
        <h1>Export to WhatsApp</h1>
        <p>
          Creates one ZIP with everything on this device, photos in original quality. Send it to the
          WhatsApp group as a document.
        </p>
      </header>

      <section className="eval__section" aria-labelledby="content-title">
        <h2 id="content-title">Content</h2>
        <dl className="summary__facts">
          <dt>Evaluations</dt>
          <dd>{loaded.evaluations.length}</dd>
          <dt>Photos</dt>
          <dd>{count('photo')}</dd>
          <dt>Videos</dt>
          <dd>{count('video')}</dd>
          <dt>Voice notes</dt>
          <dd>{count('audio')}</dd>
          <dt>Media size</dt>
          <dd>{formatBytes(bytes)}</dd>
        </dl>
        {drafts > 0 && (
          <p className="export__note" role="note">
            {plural(drafts, 'draft')} not finalized yet. Drafts are exported as they are.
          </p>
        )}
      </section>

      {stage.name === 'preparing' && (
        <div className="export__progress" aria-live="polite">
          <Progress value={stage.done} max={stage.total} label="Preparing media" />
          <span>
            Preparing media {stage.done} of {stage.total}
          </span>
        </div>
      )}
      {stage.name === 'building' && (
        <p className="export__progress" aria-live="polite">
          Creating the ZIP...
        </p>
      )}

      <div className="actionbar">
        <Button variant="secondary" icon="arrow_back" onClick={() => void navigate('/')}>
          Back
        </Button>
        <Button icon="folder_zip" disabled={working} onClick={() => void start()}>
          Create export
        </Button>
      </div>

      {stage.name === 'big' && (
        <BigZipDialog
          open
          bytes={stage.bytes}
          limit={limit}
          canDropVideos={stage.includeVideos && stage.files.some((f) => f.media.type === 'video')}
          onSplit={() => void build(stage.files, stage.includeVideos, true)}
          onWithoutVideos={() => decide(stage.files, false)}
          onBack={() => setStage({ name: 'options' })}
        />
      )}
    </div>
  )
}
