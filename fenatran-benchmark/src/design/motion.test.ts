import { MotionGlobalConfig } from 'motion/react'
import { afterEach, describe, expect, it } from 'vitest'
import { followReducedMotion, slide } from './motion'

describe('followReducedMotion', () => {
  afterEach(() => {
    MotionGlobalConfig.skipAnimations = false
  })

  it('skips Motion animations while the user prefers reduced motion', () => {
    const query = new EventTarget() as EventTarget & { matches: boolean }
    query.matches = true
    const win = { matchMedia: () => query } as unknown as Window
    followReducedMotion(win)
    expect(MotionGlobalConfig.skipAnimations).toBe(true)
    query.matches = false
    query.dispatchEvent(new Event('change'))
    expect(MotionGlobalConfig.skipAnimations).toBe(false)
  })
})

describe('slide variants', () => {
  it('moves in from the direction of travel and out the opposite way', () => {
    const enter = slide.enter as (direction: number) => { x: number }
    const exit = slide.exit as (direction: number) => { x: number }
    expect(enter(1).x).toBe(32)
    expect(enter(-1).x).toBe(-32)
    expect(exit(1).x).toBe(-32)
    expect(exit(-1).x).toBe(32)
  })

  it('does not offset while animations are skipped', () => {
    MotionGlobalConfig.skipAnimations = true
    const enter = slide.enter as (direction: number) => { x: number }
    expect(enter(1).x).toBe(0)
    MotionGlobalConfig.skipAnimations = false
  })
})
