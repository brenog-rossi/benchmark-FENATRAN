import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Dialog, EmptyState, Icon, ReadError, useToast } from '../../components/ui'
import { evaluationRepository } from '../../data/repositories/evaluation'
import type {
  ComponentEvaluation,
  Evaluation,
  FeatureAnswer,
  TruckEvaluation,
} from '../../data/types'
import { useAutosave, type AutosaveStatus } from '../../hooks/useAutosave'
import { useEvaluations } from '../../hooks/useEvaluations'
import { useLoadable, type Loadable } from '../../hooks/useLoadable'
import { evaluationTitle } from '../../lib/evaluation'
import { MediaSection, useMediaLibrary } from '../media'
import { ComponentForm } from './component/ComponentForm'
import { requiredErrors } from './schema'
import { BrandModel } from './truck/BrandModel'
import { EMPTY_ANSWER, FeatureReview } from './truck/FeatureReview'

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: 'Changes are saved automatically on this device',
  saving: 'Saving...',
  saved: 'All changes saved',
  error: 'Could not save. Check free storage.',
}

export function useEvaluationRecord(id: string): Loadable<Evaluation | null> {
  const read = useCallback(async () => (await evaluationRepository.get(id)) ?? null, [id])
  return useLoadable(read)
}

export function NotFound() {
  return (
    <EmptyState
      icon="error"
      title="Evaluation not found"
      text="It may have been deleted on this device."
      action={<Link to="/">Back to all evaluations</Link>}
    />
  )
}

export function EvaluationEditor() {
  const id = useParams().id as string
  const record = useEvaluationRecord(id)
  if (record.state === 'loading') return <p className="eval__loading">Loading...</p>
  if (record.state === 'failed') return <ReadError onRetry={record.retry} />
  const evaluation = record.value
  if (evaluation === null) return <NotFound />
  return <EditorForm key={id} initial={evaluation} />
}

function EditorForm({ initial }: { initial: Evaluation }) {
  const navigate = useNavigate()
  const toast = useToast()
  const reload = useEvaluations((state) => state.load)
  const [evaluation, setEvaluation] = useState(initial)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const library = useMediaLibrary(initial.id)

  const save = useCallback(
    async (value: Evaluation) => {
      await evaluationRepository.save(value)
      await reload()
    },
    [reload],
  )
  const autosave = useAutosave(evaluation, save)
  const errors = showErrors ? requiredErrors(evaluation) : {}

  const updateTruck = (update: (truck: TruckEvaluation) => TruckEvaluation) =>
    setEvaluation((e) => ({ ...e, truck: update(e.truck as TruckEvaluation) }))
  const updateComponent = (update: (component: ComponentEvaluation) => ComponentEvaluation) =>
    setEvaluation((e) => ({ ...e, component: update(e.component as ComponentEvaluation) }))
  const updateFeature = (featureId: string, update: (answer: FeatureAnswer) => FeatureAnswer) =>
    updateTruck((t) => ({
      ...t,
      features: { ...t.features, [featureId]: update(t.features[featureId] ?? EMPTY_ANSWER) },
    }))

  const finalize = async () => {
    if (Object.keys(requiredErrors(evaluation)).length > 0) {
      setShowErrors(true)
      toast.show('Fill in the required fields first.', 'error')
      return
    }
    await autosave.flush()
    void navigate(`/evaluation/${evaluation.id}/confirm`)
  }

  const remove = async () => {
    autosave.cancel()
    try {
      await evaluationRepository.remove(evaluation.id)
      await reload()
    } catch {
      setConfirmDelete(false)
      toast.show('Could not delete the evaluation on this device.', 'error')
      return
    }
    toast.show('Evaluation deleted', 'success')
    void navigate('/', { replace: true })
  }

  const isTruck = evaluation.kind === 'truck'

  return (
    <div className="eval">
      <header className="eval__head">
        <Link to="/" className="eval__back">
          <Icon name="arrow_back" size={20} />
          All evaluations
        </Link>
        <span className="label">
          {isTruck ? 'Truck' : 'Component'} ·{' '}
          {evaluation.status === 'finalized' ? 'Finalized' : 'Draft'}
        </span>
        <h1>{evaluationTitle(evaluation)}</h1>
        <p className="eval__status" role="status">
          {STATUS_TEXT[autosave.status]}
        </p>
      </header>

      {isTruck ? (
        <>
          <section className="eval__section" aria-labelledby="vehicle-title">
            <h2 id="vehicle-title">Vehicle</h2>
            <BrandModel
              truck={evaluation.truck as TruckEvaluation}
              errors={errors}
              onChange={(patch) => updateTruck((t) => ({ ...t, ...patch }))}
            />
            <MediaSection
              label="Brochure photos"
              library={library}
              target={{ role: 'brochure' }}
              ids={(evaluation.truck as TruckEvaluation).brochureMediaIds}
              onIdsChange={(update) =>
                updateTruck((t) => ({ ...t, brochureMediaIds: update(t.brochureMediaIds) }))
              }
              photosOnly
            />
          </section>
          <section className="eval__section" aria-labelledby="review-title">
            <h2 id="review-title">Feature review</h2>
            <p className="eval__intro">
              Score each feature from 0 (very poor or not present) to 5 (excellent). All scores are
              optional; tap a selected score again to clear it.
            </p>
            <FeatureReview
              features={(evaluation.truck as TruckEvaluation).features}
              library={library}
              onChange={updateFeature}
            />
          </section>
        </>
      ) : (
        <section className="eval__section" aria-labelledby="component-title">
          <h2 id="component-title">Component</h2>
          <ComponentForm
            component={evaluation.component as ComponentEvaluation}
            errors={errors}
            library={library}
            onChange={updateComponent}
          />
        </section>
      )}

      <div className="actionbar">
        <Button variant="secondary" icon="delete" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
        <Button icon="check" onClick={() => void finalize()}>
          {evaluation.status === 'finalized' ? 'Review summary' : 'Finalize'}
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        title="Delete this evaluation?"
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="delete" onClick={() => void remove()}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          All answers, photos, videos and voice notes of this evaluation will be removed from this
          device.
        </p>
      </Dialog>
    </div>
  )
}
