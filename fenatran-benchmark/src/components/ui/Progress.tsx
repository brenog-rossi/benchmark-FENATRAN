import { motion } from 'motion/react'
import { tween } from '../../design/motion'

type ProgressProps = { value: number; max?: number; label: string }

export function Progress({ value, max = 100, label }: ProgressProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const percent = max > 0 ? (clamped / max) * 100 : 0
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
    >
      <motion.div
        className="progress__bar"
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={tween}
      />
    </div>
  )
}
