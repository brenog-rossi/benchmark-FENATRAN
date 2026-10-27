import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button, Icon, ReadError } from '../../components/ui'
import { FEATURES } from '../../config/questionnaire'
import type { Evaluation } from '../../data/types'
import { useEvaluations } from '../../hooks/useEvaluations'
import { evaluationTitle, scoredCount } from '../../lib/evaluation'
import { formatDateTime } from '../../lib/format'
import { ExportTip, StorageMeter } from './StorageMeter'

function Item({ evaluation }: { evaluation: Evaluation }) {
  const isTruck = evaluation.kind === 'truck'
  const detail = isTruck
    ? `Truck · ${scoredCount(evaluation)} of ${FEATURES.length} scored`
    : 'Component'
  return (
    <li>
      <NavLink to={`/evaluation/${evaluation.id}`} className="eval-item">
        <Icon name={isTruck ? 'local_shipping' : 'build'} />
        <span className="eval-item__text">
          <span className="eval-item__title">{evaluationTitle(evaluation)}</span>
          <span className="eval-item__meta">
            {detail} · {formatDateTime(evaluation.updatedAt)}
          </span>
        </span>
        <Icon name="chevron_right" />
      </NavLink>
    </li>
  )
}

function Group({ title, items }: { title: string; items: Evaluation[] }) {
  if (items.length === 0) return null
  return (
    <section className="eval-group" aria-label={title}>
      <h2 className="label">
        {title} ({items.length})
      </h2>
      <ul className="eval-list">
        {items.map((evaluation) => (
          <Item key={evaluation.id} evaluation={evaluation} />
        ))}
      </ul>
    </section>
  )
}

export function EvaluationList() {
  const items = useEvaluations((state) => state.items)
  const failed = useEvaluations((state) => state.failed)
  const load = useEvaluations((state) => state.load)
  const navigate = useNavigate()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="home">
      <h1>Evaluations</h1>
      {failed ? (
        <ReadError onRetry={() => void load()} />
      ) : items === undefined ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p className="home__empty">No evaluations yet. Start with New evaluation.</p>
      ) : (
        <>
          <Group title="Drafts" items={items.filter((e) => e.status === 'draft')} />
          <Group title="Finalized" items={items.filter((e) => e.status === 'finalized')} />
        </>
      )}
      <StorageMeter refreshKey={items} />
      <ExportTip onExport={items?.length ? () => void navigate('/export') : undefined} />
      <div className="actionbar">
        <Button icon="add" onClick={() => void navigate('/new')}>
          New evaluation
        </Button>
      </div>
    </div>
  )
}
