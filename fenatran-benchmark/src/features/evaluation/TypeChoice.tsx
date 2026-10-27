import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, useToast, type IconName } from '../../components/ui'
import { evaluationRepository } from '../../data/repositories/evaluation'
import type { Evaluation } from '../../data/types'
import { useEvaluations } from '../../hooks/useEvaluations'

const OPTIONS: { kind: Evaluation['kind']; title: string; text: string; icon: IconName }[] = [
  {
    kind: 'truck',
    title: 'Truck',
    text: 'Brand, model, brochure and feature review with scores 0-5.',
    icon: 'local_shipping',
  },
  {
    kind: 'component',
    title: 'Component',
    text: 'Component name, manufacturer, images and observations.',
    icon: 'build',
  },
]

export function TypeChoice() {
  const navigate = useNavigate()
  const toast = useToast()
  const load = useEvaluations((state) => state.load)
  const [busy, setBusy] = useState(false)

  const choose = async (kind: Evaluation['kind']) => {
    setBusy(true)
    try {
      const evaluation = await evaluationRepository.create(kind)
      void load()
      void navigate(`/evaluation/${evaluation.id}`, { replace: true })
    } catch {
      toast.show('Could not create the evaluation on this device.', 'error')
      setBusy(false)
    }
  }

  return (
    <div className="eval">
      <span className="label">New evaluation</span>
      <h1>What are you evaluating?</h1>
      <div className="choice">
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="choice__option"
            disabled={busy}
            onClick={() => void choose(option.kind)}
          >
            <Icon name={option.icon} size={40} />
            <span className="choice__title">{option.title}</span>
            <span className="choice__text">{option.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
