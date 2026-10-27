import { AnimatePresence, motion } from 'motion/react'
import { useId } from 'react'
import { Icon, RatingScale, TextArea } from '../../../components/ui'
import { SCALE, type Feature } from '../../../config/questionnaire'
import type { FeatureAnswer, Score } from '../../../data/types'
import { listItem } from '../../../design/motion'
import { MediaSection, type MediaLibrary } from '../../media'

type FeatureCardProps = {
  feature: Feature
  index: number
  answer: FeatureAnswer
  open: boolean
  library: MediaLibrary
  onToggle: () => void
  onChange: (update: (answer: FeatureAnswer) => FeatureAnswer) => void
}

export function FeatureCard({
  feature,
  index,
  answer,
  open,
  library,
  onToggle,
  onChange,
}: FeatureCardProps) {
  const bodyId = useId()
  const media = answer.mediaIds.length
  return (
    <article className={`feature${open ? ' feature--open' : ''}`}>
      <h3 className="feature__heading">
        <button
          type="button"
          className="feature__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="feature__number">{index + 1}</span>
          <span className="feature__title">{feature.title}</span>
          {media > 0 && <span className="feature__media">{media} media</span>}
          <span className="feature__score">
            {answer.score === null ? 'Not scored' : `Score ${answer.score}`}
          </span>
          <span className="feature__chevron">
            <Icon name="keyboard_arrow_down" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            className="feature__body"
            variants={listItem}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="feature__inner">
              <RatingScale
                label="Score"
                value={answer.score}
                min={SCALE.min}
                max={SCALE.max}
                minLabel={SCALE.labels[0]}
                maxLabel={SCALE.labels[5]}
                onChange={(score) => onChange((a) => ({ ...a, score: score as Score | null }))}
              />
              <TextArea
                label="Comment"
                value={answer.comment}
                maxLength={2000}
                onChange={(event) => {
                  const comment = event.target.value
                  onChange((a) => ({ ...a, comment }))
                }}
              />
              <MediaSection
                label="Photos, videos and voice notes"
                library={library}
                target={{ role: 'feature', featureId: feature.id }}
                ids={answer.mediaIds}
                onIdsChange={(update) => onChange((a) => ({ ...a, mediaIds: update(a.mediaIds) }))}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}
