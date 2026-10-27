import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { evaluationRepository } from '../../data/repositories/evaluation'
import type { Evaluation } from '../../data/types'
import { useEvaluations } from '../../hooks/useEvaluations'
import { useProfile } from '../../hooks/useProfile'
import { EvaluationList, ExportTip, HomeWelcome, StorageMeter } from '.'

function Where() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderList() {
  return render(
    <MemoryRouter>
      <Where />
      <Routes>
        <Route path="/" element={<EvaluationList />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
}

function stubStorage(estimate?: () => Promise<StorageEstimate>) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: estimate ? { estimate } : undefined,
  })
}

beforeEach(async () => {
  await db.evaluations.clear()
  await db.media.clear()
  useEvaluations.setState({ items: undefined, failed: false })
  stubStorage()
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'storage')
  vi.restoreAllMocks()
})

describe('EvaluationList', () => {
  it('shows a read error and retries', async () => {
    const user = userEvent.setup()
    vi.spyOn(evaluationRepository, 'list').mockRejectedValueOnce(new Error('dexie'))
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read data on this device')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByText('No evaluations yet. Start with New evaluation.'),
    ).toBeInTheDocument()
  })

  it('shows loading, then the empty state, the tip and opens a new evaluation', async () => {
    const user = userEvent.setup()
    renderList()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(
      await screen.findByText('No evaluations yet. Start with New evaluation.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Export every day/)).toBeInTheDocument()
    expect(await screen.findByText('Media on this device: 0 B')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New evaluation' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/new')
  })

  it('groups drafts and finalized evaluations', async () => {
    const truck = await evaluationRepository.create('truck')
    await db.evaluations.put({
      ...truck,
      truck: {
        brand: 'Volvo',
        model: 'FH',
        brochureMediaIds: [],
        features: { bed: { score: 3, comment: '', mediaIds: [] } },
      },
    } satisfies Evaluation)
    const component = await evaluationRepository.create('component')
    await evaluationRepository.finalize(component.id)

    renderList()
    const drafts = await screen.findByRole('region', { name: 'Drafts' })
    expect(within(drafts).getByRole('heading', { name: 'Drafts (1)' })).toBeInTheDocument()
    const truckLink = within(drafts).getByRole('link', { name: /Volvo FH/ })
    expect(truckLink).toHaveAttribute('href', `/evaluation/${truck.id}`)
    expect(truckLink).toHaveTextContent(/Truck.*1 of 13 scored/)

    const finalized = screen.getByRole('region', { name: 'Finalized' })
    const componentLink = within(finalized).getByRole('link', { name: /Untitled component/ })
    expect(componentLink).toHaveTextContent(/Component/)
    expect(componentLink).toHaveAttribute('href', `/evaluation/${component.id}`)
  })

  it('omits empty groups', async () => {
    await evaluationRepository.create('truck')
    renderList()
    expect(await screen.findByRole('region', { name: 'Drafts' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Finalized' })).not.toBeInTheDocument()
  })

  it('opens the export when there are evaluations', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('No evaluations yet. Start with New evaluation.')
    expect(screen.queryByRole('button', { name: 'Export to WhatsApp' })).not.toBeInTheDocument()
    await evaluationRepository.create('component')
    await useEvaluations.getState().load()
    await user.click(await screen.findByRole('button', { name: 'Export to WhatsApp' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/export')
  })
})

describe('StorageMeter', () => {
  it('shows browser usage when the quota is known', async () => {
    stubStorage(() => Promise.resolve({ usage: 512, quota: 2048 }))
    render(<StorageMeter />)
    const meter = await screen.findByRole('region', { name: 'Storage' })
    expect(meter).toHaveTextContent('Media on this device: 0 B')
    expect(screen.getByRole('progressbar', { name: 'Browser storage used' })).toHaveAttribute(
      'aria-valuenow',
      '512',
    )
    expect(screen.getByText('512 B of 2.0 KB available storage used')).toBeInTheDocument()
  })

  it.each([
    ['the quota is zero', { usage: 10, quota: 0 }],
    ['the usage is unknown', { quota: 100 }],
  ])('hides browser usage when %s', async (_, result) => {
    stubStorage(() => Promise.resolve(result))
    render(<StorageMeter />)
    expect(await screen.findByRole('region', { name: 'Storage' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders nothing before the estimate is ready', () => {
    const { container } = render(<StorageMeter />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ExportTip', () => {
  it('reminds to export every day', () => {
    render(<ExportTip />)
    expect(screen.getByRole('complementary')).toHaveTextContent(/WhatsApp group/)
  })
})

describe('HomeWelcome', () => {
  it('greets by first name', () => {
    useProfile.setState({
      profile: {
        name: 'Ana Silva',
        email: 'ana@example.com',
      },
    })
    render(<HomeWelcome />)
    expect(screen.getByRole('heading', { name: 'Welcome, Ana' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('greets without a profile', async () => {
    useProfile.setState({ profile: null })
    render(<HomeWelcome />)
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Works offline/)).toBeInTheDocument())
  })
})
