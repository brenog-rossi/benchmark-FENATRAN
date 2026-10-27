import { MotionGlobalConfig, type Transition, type Variants } from 'motion/react'

// With prefers-reduced-motion every Motion animation completes at once (CSS is in typography.css).
export function followReducedMotion(win: Window = window): void {
  const query = win.matchMedia('(prefers-reduced-motion: reduce)')
  const apply = () => {
    MotionGlobalConfig.skipAnimations = query.matches
  }
  apply()
  query.addEventListener('change', apply)
}

export const duration = { fast: 0.15, base: 0.2, slow: 0.25 } as const

export const spring: Transition = { type: 'spring', stiffness: 500, damping: 40 }
export const tween: Transition = { duration: duration.base, ease: 'easeOut' }

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: tween },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}

// No offset while animations are skipped, so nothing is drawn out of place for a frame.
const offset = (direction: number) => (MotionGlobalConfig.skipAnimations ? 0 : direction * 32)

// direction: 1 = forward, -1 = backward
export const slide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: offset(direction) }),
  center: { opacity: 1, x: 0, transition: tween },
  exit: (direction: number) => ({
    opacity: 0,
    x: offset(-direction),
    transition: { duration: duration.fast },
  }),
}

export const sheet: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: spring },
  exit: { y: '100%', transition: { duration: duration.base } },
}

export const dialog: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: tween },
  exit: { opacity: 0, scale: 0.96, transition: { duration: duration.fast } },
}

export const listItem: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: tween },
  exit: { opacity: 0, height: 0, transition: { duration: duration.fast } },
}
