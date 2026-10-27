import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../data/types'
import { loadImage } from '../../lib/image'
import { PhotoAnnotator } from './PhotoAnnotator'

vi.mock('../../lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/image')>()),
  loadImage: vi.fn(),
}))

const photo: Media = {
  id: 'p1',
  evaluationId: 'ev-1',
  role: 'feature',
  type: 'photo',
  mime: 'image/jpeg',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  caption: '',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const fakeImage = { naturalWidth: 300, naturalHeight: 150 } as HTMLImageElement

function fakeContext() {
  return {
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineCap: '',
    lineJoin: '',
    strokeStyle: '',
    lineWidth: 0,
  }
}

let ctx: ReturnType<typeof fakeContext>
let rect = { left: 10, top: 20, width: 150, height: 75 }

beforeEach(() => {
  ctx = fakeContext()
  rect = { left: 10, top: 20, width: 150, height: 75 }
  vi.mocked(loadImage).mockReset().mockResolvedValue(fakeImage)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => rect as DOMRect,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['jpeg'], { type: 'image/jpeg' })),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

function setup() {
  const props = { onCancel: vi.fn(), onSave: vi.fn() }
  render(<PhotoAnnotator photo={photo} {...props} />)
  return props
}

async function ready() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save copy' })).toBeEnabled())
  return screen.getByLabelText('Photo to mark up') as HTMLCanvasElement
}

describe('PhotoAnnotator', () => {
  it('draws strokes scaled to the photo and saves a copy', async () => {
    const props = setup()
    const canvas = await ready()
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(150)
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeImage, 0, 0, 300, 150)

    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 50 })
    expect(ctx.moveTo).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('radio', { name: 'Yellow' }))
    expect(screen.getByRole('radio', { name: 'Yellow' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'false')

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 20 })
    fireEvent.pointerMove(canvas, { clientX: 85, clientY: 57.5 })
    fireEvent.pointerUp(canvas)
    expect(ctx.moveTo).toHaveBeenLastCalledWith(0, 0)
    expect(ctx.lineTo).toHaveBeenLastCalledWith(150, 75)
    expect(ctx.strokeStyle).toBe('#ffd200')
    expect(ctx.lineWidth).toBe(4)

    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 100 })
    expect(ctx.lineTo).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Save copy' }))
    await waitFor(() => expect(props.onSave).toHaveBeenCalledOnce())
    expect(props.onSave.mock.calls[0]![0]).toBeInstanceOf(Blob)
  })

  it('uses the canvas size when the element has no layout size', async () => {
    rect = { left: 0, top: 0, width: 0, height: 0 }
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 900, naturalHeight: 600 } as never)
    setup()
    const canvas = await ready()
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 40 })
    expect(ctx.moveTo).toHaveBeenLastCalledWith(30, 40)
    expect(ctx.lineWidth).toBe(6)
    fireEvent.pointerLeave(canvas)
  })

  it('undoes the last stroke', async () => {
    setup()
    const canvas = await ready()
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 30 })
    fireEvent.pointerCancel(canvas)
    expect(undo).toBeEnabled()
    ctx.stroke.mockClear()
    await userEvent.click(undo)
    expect(undo).toBeDisabled()
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('ignores drawing before the photo is loaded', () => {
    vi.mocked(loadImage).mockReturnValue(new Promise(() => {}))
    setup()
    fireEvent.pointerDown(screen.getByLabelText('Photo to mark up'), { clientX: 1, clientY: 1 })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeDisabled()
  })

  it('skips drawing when the canvas has no 2D context', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    setup()
    const canvas = await ready()
    fireEvent.pointerDown(canvas, { clientX: 1, clientY: 1 })
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('shows an error when the photo cannot be loaded', async () => {
    vi.mocked(loadImage).mockRejectedValue(new Error('broken'))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('This photo could not be edited.')
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeDisabled()
  })

  it('shows an error when the copy cannot be encoded', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null))
    const props = setup()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Save copy' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This photo could not be edited.')
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('cancels', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('ignores a load that settles after unmount', async () => {
    let resolve: (img: HTMLImageElement) => void = () => {}
    let reject: (error: Error) => void = () => {}
    vi.mocked(loadImage)
      .mockReturnValueOnce(new Promise((r) => (resolve = r)))
      .mockReturnValueOnce(new Promise((_, r) => (reject = r)))
    const first = render(<PhotoAnnotator photo={photo} onCancel={vi.fn()} onSave={vi.fn()} />)
    first.unmount()
    resolve(fakeImage)
    const second = render(<PhotoAnnotator photo={photo} onCancel={vi.fn()} onSave={vi.fn()} />)
    second.unmount()
    reject(new Error('late'))
    await Promise.resolve()
    await Promise.resolve()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
})
