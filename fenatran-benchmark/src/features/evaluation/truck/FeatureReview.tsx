import { useState } from 'react'
import { FEATURES } from '../../../config/questionnaire'
import type { FeatureAnswer } from '../../../data/types'
import type { MediaLibrary } from '../../media'
import { FeatureCard } from './FeatureCard'

export const EMPTY_ANSWER: FeatureAnswer = { score: null, comment: '', mediaIds: [] }

type FeatureReviewProps = {
  features: Record<string, FeatureAnswer>
  library: MediaLibrary
  onChange: (featureId: string, update: (answer: FeatureAnswer) => FeatureAnswer) => void
}

export function FeatureReview({ features, library, onChange }: FeatureReviewProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(FEATURES.slice(0, 1).map((f) => f.id)),
  )
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <div className="features">
      {FEATURES.map((feature, index) => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          index={index}
          answer={features[feature.id] ?? EMPTY_ANSWER}
          open={open.has(feature.id)}
          library={library}
          onToggle={() => toggle(feature.id)}
          onChange={(update) => onChange(feature.id, update)}
        />
      ))}
    </div>
  )
}
