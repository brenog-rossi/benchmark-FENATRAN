import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, ReadError, useToast } from '../../components/ui'
import { FEATURES } from '../../config/questionnaire'
import { evaluationRepository } from '../../data/repositories/evaluation'
import { mediaRepository } from '../../data/repositories/media'
import type { Evaluation, Media, MediaType } from '../../data/types'
import { useEvaluations } from '../../hooks/useEvaluations'
import { useLoadable } from '../../hooks/useLoadable'
import { brandLabel, evaluationTitle, scoredCount } from '../../lib/evaluation'
import { formatBytes } from '../../lib/format'
import { NotFound } from './EvaluationEditor'
import { requiredErrors } from './schema'

type Loaded = { evaluation: Evaluation | null; media: Media[] }

function count(media: Media[], type: MediaType) {
  return media.filter((m) => m.type === type).length
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function TruckSummary({ evaluation, media }: { evaluation: Evaluation; media: Media[] }) {
  const truck = evaluation.truck as NonNullable<Evaluation['truck']>
  return (
    <>
      <dl className="summary__facts">
        <dt>Brand</dt>
        <dd>{brandLabel(truck.brand, truck.brandOther)}</dd>
        <dt>Model</dt>
        <dd>{truck.model}</dd>
        <dt>Brochure photos</dt>
        <dd>{truck.brochureMediaIds.length}</dd>
        <dt>Features scored</dt>
        <dd>
          {scoredCount(evaluation)} of {FEATURES.length}
        </dd>
      </dl>
      <table className="summary__table">
        <caption className="label">Feature review</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Score</th>
            <th scope="col">Comment</th>
            <th scope="col">Media</th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((feature) => {
            const answer = truck.features[feature.id]
            return (
              <tr key={feature.id}>
                <th scope="row">{feature.title}</th>
                <td>{answer?.score ?? '-'}</td>
                <td>{answer?.comment.trim() ? 'Yes' : '-'}</td>
                <td>{media.filter((m) => m.featureId === feature.id).length}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function ComponentSummary({ evaluation }: { evaluation: Evaluation }) {
  const component = evaluation.component as NonNullable<Evaluation['component']>
  return (
    <dl className="summary__facts">
      <dt>Component</dt>
      <dd>{component.name}</dd>
      <dt>Manufacturer</dt>
      <dd>{component.manufacturer.trim() || '-'}</dd>
      <dt>Comments</dt>
      <dd className="summary__text">{component.comments.trim() || '-'}</dd>
    </dl>
  )
}

export function FinalizeConfirm() {
  const id = useParams().id as string
  const navigate = useNavigate()
  const toast = useToast()
  const reload = useEvaluations((state) => state.load)
  const [busy, setBusy] = useState(false)
  const read = useCallback(async (): Promise<Loaded> => {
    const [evaluation, media] = await Promise.all([
      evaluationRepository.get(id),
      mediaRepository.listByEvaluation(id),
    ])
    return { evaluation: evaluation ?? null, media }
  }, [id])
  const loaded = useLoadable(read)

  if (loaded.state === 'loading') return <p className="eval__loading">Loading...</p>
  if (loaded.state === 'failed') return <ReadError onRetry={loaded.retry} />
  const { evaluation, media } = loaded.value
  if (!evaluation) return <NotFound />

  const missing = Object.values(requiredErrors(evaluation))
  const bytes = media.reduce((sum, m) => sum + m.blob.size, 0)
  const photos = count(media, 'photo')

  const confirm = async (next: string) => {
    setBusy(true)
    try {
      await evaluationRepository.finalize(evaluation.id)
      await reload()
      toast.show('Evaluation finalized', 'success')
      void navigate(next, { replace: true })
    } catch {
      toast.show('Could not finalize on this device.', 'error')
      setBusy(false)
    }
  }

  return (
    <div className="eval summary">
      <header className="eval__head">
        <span className="label">
          Confirm · {evaluation.kind === 'truck' ? 'Truck' : 'Component'}
        </span>
        <h1>{evaluationTitle(evaluation)}</h1>
        <p>Check the summary. You can still edit or delete this evaluation after finalizing.</p>
      </header>

      {missing.length > 0 && (
        <div className="summary__missing" role="alert">
          <strong>Required before finalizing:</strong>
          <ul>
            {missing.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="eval__section" aria-labelledby="summary-title">
        <h2 id="summary-title">Summary</h2>
        {evaluation.kind === 'truck' ? (
          <TruckSummary evaluation={evaluation} media={media} />
        ) : (
          <ComponentSummary evaluation={evaluation} />
        )}
      </section>

      <section className="eval__section" aria-labelledby="export-title">
        <h2 id="export-title">What will be exported</h2>
        <ul className="summary__export">
          <li>Answers, scores and comments (data.json, summary.md, summary.xlsx)</li>
          <li>{plural(photos, 'photo')}, in original quality</li>
          <li>{plural(count(media, 'video'), 'video')}</li>
          <li>{plural(count(media, 'audio'), 'voice note')}</li>
          <li>About {formatBytes(bytes)} of media</li>
        </ul>
        <p className="eval__intro">
          The export contains all evaluations on this device. Export at the end of the day, or now
          if this was the last one.
        </p>
        <Button
          variant="secondary"
          icon="share"
          className="summary__export-now"
          disabled={busy || missing.length > 0}
          onClick={() => void confirm('/export')}
        >
          Finalize and export
        </Button>
      </section>

      <div className="actionbar">
        <Button variant="secondary" icon="edit" onClick={() => void navigate(`/evaluation/${id}`)}>
          Back to edit
        </Button>
        <Button
          icon="check"
          disabled={busy || missing.length > 0}
          onClick={() => void confirm('/')}
        >
          Confirm and finalize
        </Button>
      </div>
    </div>
  )
}
