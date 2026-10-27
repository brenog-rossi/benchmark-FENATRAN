import { Button, Icon, Progress } from '../../components/ui'
import { useStorageEstimate } from '../../hooks/useStorageEstimate'
import { formatBytes } from '../../lib/format'

export function StorageMeter({ refreshKey }: { refreshKey?: unknown }) {
  const estimate = useStorageEstimate(refreshKey)
  if (!estimate) return null
  const { mediaBytes, usage, quota } = estimate
  return (
    <section className="storage" aria-label="Storage">
      <span className="storage__title">
        <Icon name="database" size={20} />
        Media on this device: {formatBytes(mediaBytes)}
      </span>
      {usage !== undefined && quota ? (
        <>
          <Progress value={usage} max={quota} label="Browser storage used" />
          <span className="storage__text">
            {formatBytes(usage)} of {formatBytes(quota)} available storage used
          </span>
        </>
      ) : null}
    </section>
  )
}

export function ExportTip({ onExport }: { onExport?: () => void }) {
  return (
    <aside className="tip">
      <Icon name="lightbulb" size={20} />
      <div className="tip__body">
        <p>
          Export every day. Your evaluations stay only on this device until you export them and send
          them to the WhatsApp group.
        </p>
        {onExport && (
          <Button variant="secondary" icon="share" onClick={onExport}>
            Export to WhatsApp
          </Button>
        )}
      </div>
    </aside>
  )
}
