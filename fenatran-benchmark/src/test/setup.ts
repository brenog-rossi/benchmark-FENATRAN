import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { afterEach, vi } from 'vitest'

// jsdom has no object URLs.
let urlCount = 0
URL.createObjectURL = vi.fn(() => `blob:test/${(urlCount += 1)}`)
URL.revokeObjectURL = vi.fn()

afterEach(() => cleanup())
