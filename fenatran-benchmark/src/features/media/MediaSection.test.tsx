import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui'
import type { Media } from '../../data/types'
import { loadImage } from '../../lib/image'
import { MediaSection } from './MediaSection'
import type { MediaLibrary } from './useMediaLibrary'

vi.mock('../../lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/image')>()),
  loadImage: vi.fn(),
}))

function media(overrides: Partial<Media> & Pick<Media, 'id' | 'type'>): Media {
  return {
    evaluationId: 'ev-1',
    role: 'feature',
    mime: 'application/octet-stream',
    blob: new Blob([overrides.id]),
    caption: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const photo = media({ id: 'photo', type: 'photo', caption: 'Cab', thumb: new Blob(['t']) })
const marked = media({ id: 'marked', type: 'photo', annotatedFromId: 'photo' })
const video = media({ id: 'video', type: 'video', durationSec: 75 })
const clip = media({ id: 'clip', type: 'video' })
const audio = media({ id: 'audio', type: 'audio', durationSec: 5 })

function fakeLibrary(): MediaLibrary {
  const items = [photo, marked, video, clip, audio]
  return {
    items,
    byId: new Map(items.map((m) => [m.id, m])),
    addFiles: vi.fn().mockResolvedValue({ ids: ['new-1'], failed: 0 }),
    addRecording: vi.fn().mockResolvedValue('rec-1'),
    addAnnotated: vi.fn().mockResolvedValue('copy-1'),
    updateCaption: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }
}

function Harness(props: { library: MediaLibrary; initial: string[]; photosOnly?: boolean }) {
  const [ids, setIds] = useState(props.initial)
  return (
    <ToastProvider>
      <MediaSection
        label="Photos and notes"
        library={props.library}
        target={{ role: 'feature', featureId: 'f-1' }}
        ids={ids}
        onIdsChange={setIds}
        photosOnly={props.photosOnly}
      />
      <output data-testid="ids">{ids.join(',')}</output>
    </ToastProvider>
  )
}

function renderSection(initial: string[] = [], photosOnly?: boolean) {
  const library = fakeLibrary()
  const user = userEvent.setup({ applyAccept: false })
  render(<Harness library={library} initial={initial} photosOnly={photosOnly} />)
  return { library, user, ids: () => screen.getByTestId('ids').textContent }
}

const file = (name: string, type: string) => new File(['x'], name, { type })

describe('MediaSection pickers', () => {
  it('shows only photo pickers when photos only', () => {
    renderSection([], true)
    expect(screen.getByRole('region', { name: 'Photos and notes' })).toBeInTheDocument()
    expect(screen.getByLabelText('Camera')).toHaveAttribute('capture', 'environment')
    expect(screen.getByLabelText('Gallery')).toHaveAttribute('accept', 'image/*')
    expect(screen.queryByLabelText('Video')).not.toBeInTheDocument()
    expect(screen.queryByText('Voice note')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('offers video and a voice note file picker without recording support', () => {
    renderSection()
    expect(screen.getByLabelText('Gallery')).toHaveAttribute('accept', 'image/*,video/*')
    expect(screen.getByLabelText('Video')).toHaveAttribute('accept', 'video/*')
    expect(screen.getByLabelText('Voice note')).toHaveAttribute('accept', 'audio/*')
  })

  it('adds picked files and shows a saving status meanwhile', async () => {
    const { library, user, ids } = renderSection(['photo'])
    let finish: (value: { ids: string[]; failed: number }) => void = () => {}
    vi.mocked(library.addFiles).mockReturnValueOnce(new Promise((r) => (finish = r)))
    const camera = file('a.jpg', 'image/jpeg')
    await user.upload(screen.getByLabelText('Camera'), camera)

    expect(screen.getByText('Saving media...')).toBeInTheDocument()
    expect(screen.getByLabelText('Gallery')).toBeDisabled()
    expect(screen.getByText('Gallery').closest('label')).toHaveClass('media-pick--busy')
    expect(library.addFiles).toHaveBeenCalledWith([camera], { role: 'feature', featureId: 'f-1' })

    await act(async () => finish({ ids: ['n1', 'n2'], failed: 0 }))
    expect(ids()).toBe('photo,n1,n2')
    expect(screen.queryByText('Saving media...')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Gallery')).toBeEnabled()
  })

  it('reports files that could not be added', async () => {
    const { library, user, ids } = renderSection()
    vi.mocked(library.addFiles).mockResolvedValueOnce({ ids: ['ok'], failed: 2 })
    await user.upload(screen.getByLabelText('Gallery'), [
      file('a.jpg', 'image/jpeg'),
      file('b.txt', 'text/plain'),
    ])
    expect(await screen.findByText('2 file(s) could not be added.')).toBeInTheDocument()
    expect(ids()).toBe('ok')
  })

  it('reports storage errors', async () => {
    const { library, user, ids } = renderSection()
    vi.mocked(library.addFiles).mockRejectedValueOnce(new Error('quota'))
    await user.upload(screen.getByLabelText('Video'), file('c.mp4', 'video/mp4'))
    expect(
      await screen.findByText('Could not save on this device. Check free storage.'),
    ).toBeInTheDocument()
    expect(ids()).toBe('')
    expect(screen.getByLabelText('Video')).toBeEnabled()
  })

  it('adds a voice note file', async () => {
    const { library, user } = renderSection()
    await user.upload(screen.getByLabelText('Voice note'), file('n.m4a', 'audio/mp4'))
    await waitFor(() => expect(library.addFiles).toHaveBeenCalledOnce())
  })

  it('ignores an empty selection', () => {
    const { library } = renderSection()
    const input = screen.getByLabelText('Camera')
    fireEvent.change(input, { target: { files: [] } })
    Object.defineProperty(input, 'files', { value: null, configurable: true })
    fireEvent.change(input)
    expect(library.addFiles).not.toHaveBeenCalled()
  })
})

describe('MediaSection grid and item sheet', () => {
  it('renders tiles for known ids only', () => {
    renderSection(['photo', 'missing', 'marked', 'video', 'clip', 'audio'])
    const tiles = within(screen.getByRole('list')).getAllByRole('button')
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Photo 1: Cab',
      'Photo 2',
      'Video 3',
      'Video 4',
      'Voice note 5',
    ])
    expect(tiles[0]!.querySelector('img')).toBeInTheDocument()
    expect(tiles[0]!).toHaveTextContent('Cab')
    expect(tiles[1]!.querySelector('.media-tile__badge')).toBeInTheDocument()
    expect(tiles[2]!).toHaveTextContent('1:15')
    expect(tiles[3]!.querySelector('.media-tile__icon')).toHaveTextContent('')
    expect(tiles[4]!).toHaveTextContent('0:05')
  })

  it('edits the caption and keeps it when closed', async () => {
    const { library, user } = renderSection(['photo'])
    await user.click(screen.getByRole('button', { name: 'Photo 1: Cab' }))
    const sheet = screen.getByRole('dialog', { name: 'Photo' })
    expect(within(sheet).getByRole('img', { name: 'Cab' })).toBeInTheDocument()
    const field = within(sheet).getByLabelText('Observation')
    await user.clear(field)
    expect(within(sheet).getByRole('img', { name: 'Photo' })).toBeInTheDocument()
    await user.type(field, 'Door')
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    expect(library.updateCaption).toHaveBeenCalledWith('photo', 'Door')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not save an unchanged caption', async () => {
    const { library, user } = renderSection(['video'])
    await user.click(screen.getByRole('button', { name: 'Video 1' }))
    const sheet = screen.getByRole('dialog', { name: 'Video' })
    expect(sheet.querySelector('video')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Mark up' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(library.updateCaption).not.toHaveBeenCalled()
  })

  it('removes a voice note', async () => {
    const { library, user, ids } = renderSection(['photo', 'audio'])
    await user.click(screen.getByRole('button', { name: 'Voice note 2' }))
    const sheet = screen.getByRole('dialog', { name: 'Voice note' })
    expect(sheet.querySelector('audio')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Remove' }))
    expect(library.remove).toHaveBeenCalledWith(audio)
    await waitFor(() => expect(ids()).toBe('photo'))
  })
})

describe('MediaSection mark-up', () => {
  beforeEach(() => {
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 10, naturalHeight: 10 } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['jpeg'], { type: 'image/jpeg' })),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves a marked-up copy right after the original', async () => {
    const { library, user, ids } = renderSection(['photo', 'video'])
    await user.click(screen.getByRole('button', { name: 'Photo 1: Cab' }))
    await user.type(screen.getByLabelText('Observation'), '!')
    await user.click(screen.getByRole('button', { name: 'Mark up' }))
    expect(library.updateCaption).toHaveBeenCalledWith('photo', 'Cab!')

    const annotator = screen.getByRole('dialog', { name: 'Mark up photo' })
    const save = within(annotator).getByRole('button', { name: 'Save copy' })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)

    await waitFor(() => expect(ids()).toBe('photo,copy-1,video'))
    expect(library.addAnnotated).toHaveBeenCalledWith(photo, expect.any(Blob))
    expect(await screen.findByText('Marked-up copy saved')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Mark up photo' })).not.toBeInTheDocument()
  })

  it('cancels mark-up', async () => {
    const { library, user } = renderSection(['photo'])
    await user.click(screen.getByRole('button', { name: 'Photo 1: Cab' }))
    await user.click(screen.getByRole('button', { name: 'Mark up' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Mark up photo' })).not.toBeInTheDocument()
    expect(library.updateCaption).not.toHaveBeenCalled()
  })
})

class FakeRecorder {
  state = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start() {
    this.state = 'recording'
  }
  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['sound']) })
    this.onstop?.()
  }
}

describe('MediaSection voice recorder', () => {
  const getUserMedia = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  it('records a voice note', async () => {
    const { library, user, ids } = renderSection()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Voice note' }))
    const sheet = screen.getByRole('dialog', { name: 'Voice note' })
    await user.click(within(sheet).getByRole('button', { name: 'Start recording' }))
    await user.click(await within(sheet).findByRole('button', { name: 'Stop and save' }))
    await waitFor(() => expect(ids()).toBe('rec-1'))
    expect(library.addRecording).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number), {
      role: 'feature',
      featureId: 'f-1',
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('attaches an audio file when the microphone is blocked', async () => {
    getUserMedia.mockRejectedValue(new Error('denied'))
    const { library, user, ids } = renderSection()
    await user.click(screen.getByRole('button', { name: 'Voice note' }))
    await user.click(screen.getByRole('button', { name: 'Start recording' }))
    const note = file('n.m4a', 'audio/mp4')
    await user.upload(await screen.findByLabelText('Attach audio file'), note)
    expect(library.addFiles).toHaveBeenCalledWith([note], { role: 'feature', featureId: 'f-1' })
    await waitFor(() => expect(ids()).toBe('new-1'))
  })

  it('closes the recorder on cancel', async () => {
    const { user } = renderSection()
    await user.click(screen.getByRole('button', { name: 'Voice note' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
