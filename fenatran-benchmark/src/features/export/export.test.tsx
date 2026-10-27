import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui'
import { db } from '../../data/db'
import { useEvaluations } from '../../hooks/useEvaluations'
import { exportSource, truckEvaluation } from '../../test/factories/export'
import { ExportFlow } from '.'
import * as excel from './builders/excel'
import * as model from './builders/model'
import * as exporter from './exporter'

vi.mock('../../lib/image', () => ({
  resizeImage: (blob: Blob) => Promise.resolve(blob),
}))
vi.mock('./exporter', async (importOriginal) => {
  const real = await importOriginal<typeof import('./exporter')>()
  return { ...real, loadExportSource: vi.fn(), wipeEvaluations: vi.fn(real.wipeEvaluations) }
})
vi.mock('./builders/model', async (importOriginal) => {
  const real = await importOriginal<typeof import('./builders/model')>()
  return { ...real, prepareMedia: vi.fn(real.prepareMedia) }
})
vi.mock('./builders/excel', async (importOriginal) => {
  const real = await importOriginal<typeof import('./builders/excel')>()
  return { ...real, buildExcel: vi.fn(real.buildExcel) }
})

const loadSource = vi.mocked(exporter.loadExportSource)
const RESERVE = 2 * 1024 * 1024

function Where() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderFlow(limit?: number) {
  return render(
    <MemoryRouter initialEntries={['/export']}>
      <ToastProvider>
        <Where />
        <Routes>
          <Route path="/" element={<p>Home</p>} />
          <Route path="/export" element={<ExportFlow limit={limit} />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const location = () => screen.getByTestId('location').textContent

function stubShare(canShare: (data: { files: File[] }) => boolean) {
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare })
  return share
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

async function createExport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Create export' }))
  return screen.findByRole('heading', { name: 'Send to the WhatsApp group' })
}

beforeEach(() => {
  loadSource.mockResolvedValue(exportSource())
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
  vi.restoreAllMocks()
})

describe('ExportFlow options', () => {
  it('shows a read error and retries', async () => {
    const user = userEvent.setup()
    loadSource.mockRejectedValueOnce(new Error('dexie'))
    renderFlow()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read data on this device')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'Create export' })).toBeInTheDocument()
  })
  it('shows the empty state without evaluations or profile', async () => {
    const user = userEvent.setup()
    loadSource.mockResolvedValueOnce({ ...exportSource(), evaluations: [] })
    const { unmount } = renderFlow()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Nothing to export' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(location()).toBe('/')
    unmount()

    loadSource.mockResolvedValueOnce(null)
    renderFlow()
    expect(await screen.findByRole('heading', { name: 'Nothing to export' })).toBeInTheDocument()
  })

  it('ignores a load that finishes after leaving', async () => {
    const pending = deferred<null>()
    loadSource.mockReturnValueOnce(pending.promise)
    const { unmount } = renderFlow()
    unmount()
    pending.resolve(null)
    await pending.promise
  })

  it('summarises the content, warns about drafts and goes back', async () => {
    const user = userEvent.setup()
    renderFlow()
    const content = await screen.findByRole('region', { name: 'Content' })
    expect(content).toHaveTextContent('Evaluations2Photos3Videos1Voice notes1Media size75 B')
    expect(screen.getByRole('note')).toHaveTextContent('1 draft not finalized yet.')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(location()).toBe('/')
  })

  it('has no draft note when everything is finalized', async () => {
    loadSource.mockResolvedValueOnce({ ...exportSource(), evaluations: [truckEvaluation()] })
    renderFlow()
    expect(await screen.findByRole('region', { name: 'Content' })).toHaveTextContent('Evaluations1')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

describe('ExportFlow building', () => {
  it('shows progress while preparing and building', async () => {
    const user = userEvent.setup()
    const excelDone = deferred<Blob>()
    vi.mocked(excel.buildExcel).mockReturnValueOnce(excelDone.promise)
    renderFlow()
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    expect(await screen.findByText('Creating the ZIP...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create export' })).toBeDisabled()
    excelDone.resolve(new Blob(['x']))
    expect(
      await screen.findByRole('heading', { name: 'Send to the WhatsApp group' }),
    ).toBeInTheDocument()
  })

  it('shows media progress', async () => {
    const user = userEvent.setup()
    const gate = deferred<model.ExportFile[]>()
    vi.mocked(model.prepareMedia).mockImplementationOnce((_source, onProgress) => {
      onProgress?.(2, 5)
      return gate.promise
    })
    renderFlow()
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    expect(await screen.findByText('Preparing media 2 of 5')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Preparing media' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
    gate.resolve([])
    expect(
      await screen.findByRole('heading', { name: 'Send to the WhatsApp group' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['preparing', () => vi.mocked(model.prepareMedia).mockRejectedValueOnce(new Error('x'))],
    ['building', () => vi.mocked(excel.buildExcel).mockRejectedValueOnce(new Error('x'))],
  ])('reports an error while %s', async (_, breakIt) => {
    const user = userEvent.setup()
    breakIt()
    renderFlow()
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    expect(
      await screen.findByText('The export could not be created on this device.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create export' })).toBeEnabled()
  })
})

describe('Big ZIP dialog', () => {
  it('exports without videos when that fits', async () => {
    const user = userEvent.setup()
    renderFlow(RESERVE + 40)
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    const dialog = await screen.findByRole('dialog', { name: 'The export is too big for WhatsApp' })
    expect(dialog).toHaveTextContent('WhatsApp accepts files up to 2.0 MB')
    await user.click(within(dialog).getByRole('button', { name: 'Export without videos' }))
    await screen.findByRole('heading', { name: 'Send to the WhatsApp group' })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('asks again without the video option, then splits', async () => {
    const user = userEvent.setup()
    renderFlow(RESERVE + 2)
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    let dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Export without videos' }))
    dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).queryByRole('button', { name: 'Export without videos' }),
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Split into parts' }))
    await screen.findByRole('heading', { name: 'Send to the WhatsApp group' })
    expect(screen.getByRole('heading', { name: /1\. ZIP files \(\d+\)/ })).toBeInTheDocument()
    expect(screen.getAllByText(/_part\dof\d\.zip$/).length).toBeGreaterThan(1)
  })

  it('offers no video option when there are no videos, and goes back', async () => {
    const user = userEvent.setup()
    const source = exportSource()
    loadSource.mockResolvedValueOnce({
      ...source,
      media: source.media.filter((m) => m.type !== 'video'),
    })
    renderFlow(RESERVE)
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/without videos/)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Create export' })).toBeEnabled()
  })
})

describe('ShareStep', () => {
  it('falls back to downloads without the Web Share API', async () => {
    const user = userEvent.setup()
    renderFlow()
    await createExport(user)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Download FENATRAN2026_Joao_da_Silva_/ }))
    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument()
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /photos/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2. Clean up' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(location()).toBe('/')
  })

  it('shares the ZIP', async () => {
    const user = userEvent.setup()
    const share = stubShare(() => true)
    renderFlow()
    await createExport(user)

    share.mockRejectedValueOnce(new DOMException('cancel', 'AbortError'))
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.queryByRole('img', { name: 'Sent' })).not.toBeInTheDocument()

    share.mockRejectedValueOnce(new Error('broken'))
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(
      await screen.findByText('Sharing did not work. Use Download instead.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share' }))
    const zipCall = share.mock.calls.at(-1)![0] as ShareData
    expect(zipCall.text).toBe('FENATRAN 2026')
    expect(zipCall.files![0]!.name).toMatch(/\.zip$/)
    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument()
  })

  it('numbers each part in the share text', async () => {
    const user = userEvent.setup()
    const share = stubShare(() => true)
    renderFlow(RESERVE + 2)
    await user.click(await screen.findByRole('button', { name: 'Create export' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Split into parts' }))
    await screen.findByRole('heading', { name: 'Send to the WhatsApp group' })
    await user.click(screen.getAllByRole('button', { name: 'Share' })[1]!)
    const call = share.mock.calls.at(-1)![0] as ShareData
    expect(call.text).toMatch(/^FENATRAN 2026 - part 2 of \d+$/)
  })
})

describe('WipeConfirm', () => {
  beforeEach(async () => {
    await db.evaluations.put(truckEvaluation())
    useEvaluations.setState({ items: undefined })
  })

  it('deletes evaluations after confirmation and keeps the profile', async () => {
    const user = userEvent.setup()
    renderFlow()
    await createExport(user)
    await user.click(screen.getByRole('button', { name: 'I sent everything' }))
    let dialog = screen.getByRole('dialog', { name: 'Delete evaluations from this device?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await db.evaluations.count()).toBe(1)

    await user.click(screen.getByRole('button', { name: 'I sent everything' }))
    dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete evaluations' }))
    await waitFor(() => expect(location()).toBe('/'))
    expect(await db.evaluations.count()).toBe(0)
    expect(useEvaluations.getState().items).toEqual([])
    expect(
      screen.getByText('Evaluations deleted from this device. Your profile is kept.'),
    ).toBeInTheDocument()
  })

  it('reports a failed wipe', async () => {
    const user = userEvent.setup()
    vi.mocked(exporter.wipeEvaluations).mockRejectedValueOnce(new Error('quota'))
    renderFlow()
    await createExport(user)
    await user.click(screen.getByRole('button', { name: 'I sent everything' }))
    await user.click(screen.getByRole('button', { name: 'Delete evaluations' }))
    expect(
      await screen.findByText('Could not delete the evaluations on this device.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete evaluations' })).toBeEnabled()
    expect(location()).toBe('/export')
  })
})
