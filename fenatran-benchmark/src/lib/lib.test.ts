import { afterEach, describe, expect, it, vi } from 'vitest'
import { maskEmail } from './emailMask'
import { newId, nowIso } from './ids'
import { requestPersistence } from './storage'

describe('maskEmail', () => {
  it('lowercases, strips spaces and keeps a single @', () => {
    expect(maskEmail(' Ana.Silva @Example.com')).toBe('ana.silva@example.com')
    expect(maskEmail('a@@b@c.com')).toBe('a@bc.com')
    expect(maskEmail('plain')).toBe('plain')
  })
})

describe('ids', () => {
  it('creates unique ids and ISO timestamps', () => {
    expect(newId()).not.toBe(newId())
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('requestPersistence', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the browser answer', async () => {
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockResolvedValue(true) } })
    expect(await requestPersistence()).toBe(true)
  })
  it('returns false when unsupported', async () => {
    vi.stubGlobal('navigator', {})
    expect(await requestPersistence()).toBe(false)
  })
  it('returns false when it throws', async () => {
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockRejectedValue(new Error('x')) } })
    expect(await requestPersistence()).toBe(false)
  })
})
