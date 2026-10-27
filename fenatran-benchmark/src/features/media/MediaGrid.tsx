import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../../components/ui'
import type { Media } from '../../data/types'
import { listItem } from '../../design/motion'
import { formatDuration } from '../../lib/format'
import { objectUrl } from '../../lib/objectUrl'

export const TYPE_LABEL = { photo: 'Photo', video: 'Video', audio: 'Voice note' } as const

function Preview({ media }: { media: Media }) {
  if (media.type === 'photo') {
    return <img src={objectUrl(media.thumb ?? media.blob)} alt="" loading="lazy" />
  }
  return (
    <span className="media-tile__icon">
      <Icon name={media.type === 'video' ? 'videocam' : 'graphic_eq'} size={32} />
      {media.durationSec !== undefined && <span>{formatDuration(media.durationSec)}</span>}
    </span>
  )
}

type MediaGridProps = { items: Media[]; onOpen: (media: Media) => void }

export function MediaGrid({ items, onOpen }: MediaGridProps) {
  if (items.length === 0) return null
  return (
    <ul className="media-grid">
      <AnimatePresence initial={false}>
        {items.map((media, index) => (
          <motion.li
            key={media.id}
            layout
            variants={listItem}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              type="button"
              className="media-tile"
              onClick={() => onOpen(media)}
              aria-label={`${TYPE_LABEL[media.type]} ${index + 1}${media.caption ? `: ${media.caption}` : ''}`}
            >
              <Preview media={media} />
              {media.annotatedFromId && (
                <span className="media-tile__badge">
                  <Icon name="draw" size={16} />
                </span>
              )}
              {media.caption && <span className="media-tile__caption">{media.caption}</span>}
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
