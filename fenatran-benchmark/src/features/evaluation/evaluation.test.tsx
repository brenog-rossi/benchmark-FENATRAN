import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui'
import { OTHER } from '../../config/questionnaire'
import { db } from '../../data/db'
import { evaluationRepository } from '../../data/repositories/evaluation'
import { mediaRepository } from '../../data/repositories/media'
import type { ComponentEvaluation, Evaluation, Media, TruckEvaluation } from '../../data/types'
import { useEvaluations } from '../../hooks/useEvaluations'
import { EvaluationEditor, FinalizeConfirm, TypeChoice } from '.'
import { requiredErrors } from './schema'

const SAVE_WAIT = { timeout: 3000 }

function Where() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Where />
        <Routes>
          <Route path="/" element={<p>Home</p>} />
          <Route path="/new" element={<TypeChoice />} />
          <Route path="/evaluation/:id" element={<EvaluationEditor />} />
          <Route path="/evaluation/:id/confirm" element={<FinalizeConfirm />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const location = () => screen.getByTestId('location').textContent

async function seedTruck(truck: Partial<TruckEvaluation> = {}, extra: Partial<Evaluation> = {}) {
  const created = await evaluationRepository.create('truck')
  const evaluation: Evaluation = {
    ...created,
    ...extra,
    truck: { ...(created.truck as TruckEvaluation), ...truck },
  }
  await db.evaluations.put(evaluation)
  return evaluation
}

async function seedComponent(
  component: Partial<ComponentEvaluation> = {},
  extra: Partial<Evaluation> = {},
) {
  const created = await evaluationRepository.create('component')
  const evaluation: Evaluation = {
    ...created,
    ...extra,
    component: { ...(created.component as ComponentEvaluation), ...component },
  }
  await db.evaluations.put(evaluation)
  return evaluation
}

function media(evaluationId: string, patch: Partial<Media> & Pick<Media, 'id' | 'type'>): Media {
  return {
    evaluationId,
    role: 'feature',
    mime: 'application/octet-stream',
    blob: new Blob(['x'.repeat(1024)]),
    caption: '',
    createdAt: '2026-10-19T10:00:00.000Z',
    ...patch,
  }
}

const video = () => new File(['v'], 'clip.mp4', { type: 'video/mp4' })

beforeEach(async () => {
  await db.evaluations.clear()
  await db.media.clear()
  useEvaluations.setState({ items: undefined })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requiredErrors', () => {
  const base = { id: 'e', status: 'draft', createdAt: '', updatedAt: '' } as const

  it('requires brand and model for trucks, also without truck data', () => {
    expect(Object.keys(requiredErrors({ ...base, kind: 'truck' }))).toEqual(['brand', 'model'])
    const truck = { brand: ' ', model: '', brochureMediaIds: [], features: {} }
    expect(requiredErrors({ ...base, kind: 'truck', truck })).toEqual({
      brand: 'Choose the brand',
      model: 'Enter the model',
    })
  })

  it('requires the brand name when the brand is Other', () => {
    const truck = { brand: OTHER, model: 'X', brochureMediaIds: [], features: {} }
    expect(requiredErrors({ ...base, kind: 'truck', truck })).toEqual({
      brandOther: 'Enter the brand name',
    })
    expect(
      requiredErrors({ ...base, kind: 'truck', truck: { ...truck, brandOther: '  ' } }),
    ).toEqual({ brandOther: 'Enter the brand name' })
    expect(
      requiredErrors({ ...base, kind: 'truck', truck: { ...truck, brandOther: 'Tatra' } }),
    ).toEqual({})
  })

  it('requires the component name', () => {
    expect(Object.keys(requiredErrors({ ...base, kind: 'component' }))).toEqual(['name'])
    const component = { name: ' ', manufacturer: '', mediaIds: [], comments: '' }
    expect(requiredErrors({ ...base, kind: 'component', component })).toEqual({
      name: 'Enter the component name',
    })
    component.name = ' Seat '
    expect(requiredErrors({ ...base, kind: 'component', component })).toEqual({})
  })
})

describe('TypeChoice', () => {
  it.each([
    ['Truck', 'truck'],
    ['Component', 'component'],
  ] as const)('creates a %s evaluation and opens it', async (title, kind) => {
    renderAt('/new')
    expect(screen.getByRole('heading', { name: 'What are you evaluating?' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: new RegExp(`^${title}`) }))
    await waitFor(() => expect(location()).toMatch(/^\/evaluation\/.+/))
    const [stored] = (await db.evaluations.toArray()) as [Evaluation]
    expect(stored.kind).toBe(kind)
    expect(location()).toBe(`/evaluation/${stored.id}`)
    await waitFor(() => expect(useEvaluations.getState().items).toHaveLength(1))
  })

  it('reports when the evaluation cannot be created', async () => {
    vi.spyOn(evaluationRepository, 'create').mockRejectedValue(new Error('quota'))
    renderAt('/new')
    const truck = screen.getByRole('button', { name: /^Truck/ })
    await userEvent.setup().click(truck)
    expect(
      await screen.findByText('Could not create the evaluation on this device.'),
    ).toBeInTheDocument()
    expect(truck).toBeEnabled()
    expect(location()).toBe('/new')
  })
})

describe('EvaluationEditor', () => {
  it('shows loading and then not found', async () => {
    renderAt('/evaluation/missing')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Evaluation not found' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to all evaluations' }))
    expect(location()).toBe('/')
  })

  it('ignores a load that finishes after unmount', async () => {
    const get = vi.spyOn(evaluationRepository, 'get')
    const { unmount } = renderAt('/evaluation/gone')
    unmount()
    await get.mock.results[0]?.value
    expect(get).toHaveBeenCalledWith('gone')
  })

  it('shows a read error with retry instead of loading forever', async () => {
    const user = userEvent.setup()
    vi.spyOn(evaluationRepository, 'get').mockRejectedValueOnce(new Error('dexie'))
    renderAt('/evaluation/missing')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read data on this device')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Evaluation not found' })).toBeInTheDocument()
  })

  it('edits a truck: brand, model, brochure and feature review', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const evaluation = await seedTruck({
      features: { seats: { score: 2, comment: '', mediaIds: ['missing-media'] } },
    })
    renderAt(`/evaluation/${evaluation.id}`)
    expect(await screen.findByRole('heading', { name: 'Untitled truck' })).toBeInTheDocument()
    expect(screen.getByText(/Truck.*Draft/)).toBeInTheDocument()
    expect(screen.getByText('Changes are saved automatically on this device')).toBeInTheDocument()

    const brand = screen.getByLabelText('Brand')
    await user.selectOptions(brand, OTHER)
    const brandName = screen.getByLabelText('Brand name')
    expect(brandName).toHaveValue('')
    await user.type(brandName, 'Tatra')
    expect(screen.getByRole('heading', { name: 'Tatra' })).toBeInTheDocument()
    await user.selectOptions(brand, 'Volvo')
    expect(screen.queryByLabelText('Brand name')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Model'), 'FH 540')
    expect(screen.getByRole('heading', { name: 'Volvo FH 540' })).toBeInTheDocument()

    const brochure = screen.getByRole('region', { name: 'Brochure photos' })
    await user.upload(within(brochure).getByLabelText('Gallery'), video())
    expect(await within(brochure).findByRole('button', { name: 'Video 1' })).toBeInTheDocument()

    const seats = screen.getByRole('button', { name: /Driver and passenger seats/ })
    expect(seats).toHaveTextContent('1 media')
    expect(seats).toHaveTextContent('Score 2')
    expect(seats).toHaveAttribute('aria-expanded', 'false')

    const first = screen.getByRole('button', { name: /Robustness and quality/ })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('radio', { name: '3' }))
    expect(first).toHaveTextContent('Score 3')
    await user.click(screen.getByRole('radio', { name: '3' }))
    expect(first).toHaveTextContent('Not scored')
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.type(screen.getByLabelText('Comment'), 'Solid')
    expect(screen.getByLabelText('Comment')).toHaveValue('Solid')
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByLabelText('Comment')).not.toBeInTheDocument())

    const bed = screen.getByRole('button', { name: /Bed/ })
    await user.click(bed)
    expect(bed).toHaveAttribute('aria-expanded', 'true')
    const bedCard = bed.closest('article') as HTMLElement
    await user.upload(within(bedCard).getByLabelText('Video'), video())
    await waitFor(() => expect(bed).toHaveTextContent('1 media'))

    expect(await screen.findByText('All changes saved', {}, SAVE_WAIT)).toBeInTheDocument()
    await waitFor(async () => {
      const stored = (await db.evaluations.get(evaluation.id)) as Evaluation
      expect(stored.truck?.model).toBe('FH 540')
      expect(stored.truck?.brandOther).toBeUndefined()
      expect(stored.truck?.brochureMediaIds).toHaveLength(1)
      expect(stored.truck?.features['chassis-robustness']).toMatchObject({
        score: 4,
        comment: 'Solid',
      })
      expect(stored.truck?.features.bed?.mediaIds).toHaveLength(1)
    }, SAVE_WAIT)
  }, 15_000)

  it('shows an error when autosave fails', async () => {
    vi.spyOn(evaluationRepository, 'save').mockRejectedValue(new Error('full'))
    const evaluation = await seedTruck()
    renderAt(`/evaluation/${evaluation.id}`)
    await userEvent.setup().type(await screen.findByLabelText('Model'), 'X')
    expect(
      await screen.findByText('Could not save. Check free storage.', {}, SAVE_WAIT),
    ).toBeInTheDocument()
  })

  it('validates before finalizing and then opens the summary', async () => {
    const user = userEvent.setup()
    const evaluation = await seedTruck()
    renderAt(`/evaluation/${evaluation.id}`)
    await user.click(await screen.findByRole('button', { name: 'Finalize' }))
    expect(screen.getByText('Fill in the required fields first.')).toBeInTheDocument()
    expect(screen.getByText('Choose the brand', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Enter the model')).toBeInTheDocument()
    expect(location()).toBe(`/evaluation/${evaluation.id}`)

    await user.selectOptions(screen.getByLabelText('Brand'), OTHER)
    expect(screen.getByText('Enter the brand name')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Brand name'), 'Tatra')
    await user.type(screen.getByLabelText('Model'), 'Phoenix')
    expect(screen.queryByText('Enter the model')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finalize' }))
    await waitFor(() => expect(location()).toBe(`/evaluation/${evaluation.id}/confirm`))
    expect(await screen.findByRole('heading', { name: 'Tatra Phoenix' })).toBeInTheDocument()
    const stored = (await db.evaluations.get(evaluation.id)) as Evaluation
    expect(stored.truck?.model).toBe('Phoenix')
  })

  it('edits a component and validates its name', async () => {
    const user = userEvent.setup()
    const evaluation = await seedComponent()
    renderAt(`/evaluation/${evaluation.id}`)
    expect(await screen.findByRole('heading', { name: 'Untitled component' })).toBeInTheDocument()
    expect(screen.getByText(/Component.*Draft/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finalize' }))
    expect(screen.getByText('Enter the component name')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Component' }), 'Battery')
    await user.type(screen.getByLabelText('Manufacturer'), 'Wabco')
    await user.type(screen.getByLabelText('Comments and observations'), 'Compact')
    const section = screen.getByRole('region', { name: 'Images, videos and voice notes' })
    await user.upload(within(section).getByLabelText('Video'), video())
    expect(await within(section).findByRole('button', { name: 'Video 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Battery' })).toBeInTheDocument()
    expect(screen.queryByText('Enter the component name')).not.toBeInTheDocument()

    await waitFor(async () => {
      const stored = (await db.evaluations.get(evaluation.id)) as Evaluation
      expect(stored.component).toMatchObject({
        name: 'Battery',
        manufacturer: 'Wabco',
        comments: 'Compact',
      })
      expect(stored.component?.mediaIds).toHaveLength(1)
    }, SAVE_WAIT)
  })

  it('labels the action of a finalized evaluation as review', async () => {
    const evaluation = await seedComponent({ name: 'Seat' }, { status: 'finalized' })
    renderAt(`/evaluation/${evaluation.id}`)
    const review = await screen.findByRole('button', { name: 'Review summary' })
    expect(screen.getByText(/Component.*Finalized/)).toBeInTheDocument()
    await userEvent.setup().click(review)
    await waitFor(() => expect(location()).toBe(`/evaluation/${evaluation.id}/confirm`))
  })

  it('asks before deleting and removes the evaluation with its media', async () => {
    const user = userEvent.setup()
    const evaluation = await seedComponent({ name: 'Seat' })
    await db.media.add(media(evaluation.id, { id: 'm1', type: 'video', role: 'component' }))
    renderAt(`/evaluation/${evaluation.id}`)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this evaluation?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(location()).toBe('/'))
    expect(screen.getByText('Evaluation deleted')).toBeInTheDocument()
    expect(await db.evaluations.count()).toBe(0)
    expect(await db.media.count()).toBe(0)
    expect(useEvaluations.getState().items).toEqual([])
  })

  it('keeps the evaluation and shows a toast when deleting fails', async () => {
    const user = userEvent.setup()
    const evaluation = await seedComponent({ name: 'Seat' })
    vi.spyOn(evaluationRepository, 'remove').mockRejectedValueOnce(new Error('dexie'))
    renderAt(`/evaluation/${evaluation.id}`)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(
      await screen.findByText('Could not delete the evaluation on this device.'),
    ).toBeInTheDocument()
    expect(location()).toBe(`/evaluation/${evaluation.id}`)
    expect(await db.evaluations.count()).toBe(1)
  })
})

describe('FinalizeConfirm', () => {
  it('shows loading and then not found', async () => {
    renderAt('/evaluation/missing/confirm')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Evaluation not found' })).toBeInTheDocument()
  })

  it('ignores a load that finishes after unmount', async () => {
    const list = vi.spyOn(mediaRepository, 'listByEvaluation')
    const { unmount } = renderAt('/evaluation/gone/confirm')
    unmount()
    await list.mock.results[0]?.value
    expect(list).toHaveBeenCalledWith('gone')
  })

  it('shows a read error when the media cannot be read', async () => {
    vi.spyOn(mediaRepository, 'listByEvaluation').mockRejectedValueOnce(new Error('dexie'))
    renderAt('/evaluation/missing/confirm')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read data on this device')
  })

  it('summarises a truck and finalizes it', async () => {
    const user = userEvent.setup()
    const evaluation = await seedTruck({
      brand: OTHER,
      brandOther: 'Tatra',
      model: 'Phoenix',
      brochureMediaIds: ['b1'],
      features: {
        'chassis-robustness': { score: 4, comment: 'Solid', mediaIds: [] },
        seats: { score: null, comment: '  ', mediaIds: ['v1'] },
      },
    })
    vi.spyOn(mediaRepository, 'listByEvaluation').mockResolvedValue([
      media(evaluation.id, { id: 'b1', type: 'photo', role: 'brochure' }),
      media(evaluation.id, { id: 'v1', type: 'video', featureId: 'seats' }),
      media(evaluation.id, { id: 'a1', type: 'audio', featureId: 'seats' }),
      media(evaluation.id, { id: 'a2', type: 'audio', featureId: 'bed' }),
    ])
    renderAt(`/evaluation/${evaluation.id}/confirm`)
    expect(await screen.findByRole('heading', { name: 'Tatra Phoenix' })).toBeInTheDocument()
    expect(screen.getByText(/Confirm.*Truck/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const facts = screen.getByText('Model').parentElement as HTMLElement
    expect(facts).toHaveTextContent('BrandTatra')
    expect(facts).toHaveTextContent('ModelPhoenix')
    expect(facts).toHaveTextContent('Brochure photos1')
    expect(facts).toHaveTextContent('Features scored1 of 13')

    const row = (name: RegExp) =>
      within(screen.getByRole('table'))
        .getByRole('rowheader', { name })
        .closest('tr') as HTMLElement
    expect(row(/Robustness and quality/)).toHaveTextContent(/4Yes0$/)
    expect(row(/Driver and passenger seats/)).toHaveTextContent(/-\s*-\s*2$/)
    expect(row(/^Bed$/)).toHaveTextContent(/-\s*-\s*1$/)

    expect(screen.getByText(/^1 photo,/)).toBeInTheDocument()
    expect(screen.getByText('1 video')).toBeInTheDocument()
    expect(screen.getByText('2 voice notes')).toBeInTheDocument()
    expect(screen.getByText('About 4.0 KB of media')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm and finalize' }))
    await waitFor(() => expect(location()).toBe('/'))
    expect(screen.getByText('Evaluation finalized')).toBeInTheDocument()
    const stored = (await db.evaluations.get(evaluation.id)) as Evaluation
    expect(stored.status).toBe('finalized')
    expect(stored.finalizedAt).toBeDefined()
    expect(useEvaluations.getState().items).toHaveLength(1)
  })

  it('lists missing fields, blocks confirming and goes back to edit', async () => {
    const user = userEvent.setup()
    const evaluation = await seedTruck()
    renderAt(`/evaluation/${evaluation.id}/confirm`)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Required before finalizing:')
    expect(alert).toHaveTextContent('Choose the brand')
    expect(alert).toHaveTextContent('Enter the model')
    expect(screen.getByRole('button', { name: 'Confirm and finalize' })).toBeDisabled()
    expect(screen.getByText('0 videos')).toBeInTheDocument()
    expect(screen.getByText('About 0 B of media')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to edit' }))
    expect(location()).toBe(`/evaluation/${evaluation.id}`)
  })

  it('summarises a component with and without optional text', async () => {
    const first = await seedComponent({ name: 'Seat', manufacturer: ' ', comments: 'Firm' })
    const { unmount } = renderAt(`/evaluation/${first.id}/confirm`)
    expect(await screen.findByRole('heading', { name: 'Seat' })).toBeInTheDocument()
    expect(screen.getByText(/Confirm.*Component/)).toBeInTheDocument()
    let facts = screen.getByText('Manufacturer').parentElement as HTMLElement
    expect(facts).toHaveTextContent('ComponentSeatManufacturer-CommentsFirm')
    expect(screen.getByText(/^0 photos,/)).toBeInTheDocument()
    unmount()

    const second = await seedComponent({ name: 'Lamp', manufacturer: 'Hella', comments: '' })
    renderAt(`/evaluation/${second.id}/confirm`)
    expect(await screen.findByRole('heading', { name: 'Lamp' })).toBeInTheDocument()
    facts = screen.getByText('Manufacturer').parentElement as HTMLElement
    expect(facts).toHaveTextContent('ComponentLampManufacturerHellaComments-')
  })

  it('reports when finalizing fails', async () => {
    vi.spyOn(evaluationRepository, 'finalize').mockRejectedValue(new Error('locked'))
    const evaluation = await seedComponent({ name: 'Seat' })
    renderAt(`/evaluation/${evaluation.id}/confirm`)
    const confirm = await screen.findByRole('button', { name: 'Confirm and finalize' })
    await userEvent.setup().click(confirm)
    expect(await screen.findByText('Could not finalize on this device.')).toBeInTheDocument()
    expect(confirm).toBeEnabled()
    expect(location()).toBe(`/evaluation/${evaluation.id}/confirm`)
  })

  it('finalizes and opens the export', async () => {
    const evaluation = await seedComponent({ name: 'Seat' })
    renderAt(`/evaluation/${evaluation.id}/confirm`)
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Finalize and export' }))
    await waitFor(() => expect(location()).toBe('/export'))
    expect(((await db.evaluations.get(evaluation.id)) as Evaluation).status).toBe('finalized')
  })
})
