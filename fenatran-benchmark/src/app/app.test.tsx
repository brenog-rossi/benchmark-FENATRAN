import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { profileRepository } from '../data/repositories/profile'
import { useEvaluations } from '../hooks/useEvaluations'
import { useProfile } from '../hooks/useProfile'
import { App } from './App'
import { AppShell, TwoPane } from './AppShell'

describe('AppShell', () => {
  it('shows header, content and storage footer', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('banner')).toHaveTextContent('FENATRAN 2026 Benchmark')
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Your data stays on this device until you export it',
    )
  })
})

describe('TwoPane', () => {
  it('renders list and detail regions', () => {
    render(<TwoPane list={<p>L</p>} detail={<p>D</p>} />)
    expect(within(screen.getByRole('region', { name: 'List' })).getByText('L')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Editor' })).getByText('D'),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'List' }).parentElement?.className).toBe('twopane')
  })

  it.each(['list', 'detail'] as const)('adds the %s active modifier class', (active) => {
    render(<TwoPane list={<p>L</p>} detail={<p>D</p>} active={active} />)
    expect(screen.getByRole('region', { name: 'List' }).parentElement).toHaveClass(
      'twopane',
      `twopane--${active}`,
    )
  })
})

describe('App', () => {
  beforeEach(async () => {
    await db.profile.clear()
    await db.evaluations.clear()
    useProfile.setState({ profile: undefined })
    useEvaluations.setState({ items: undefined })
    window.location.hash = '#/'
  })

  it('gates the home route behind onboarding', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()
  })

  it('renders the evaluation list and welcome panes on the home route', async () => {
    useProfile.setState({
      profile: {
        name: 'Ana Silva',
        email: 'ana@example.com',
      },
    })
    render(<App />)
    const list = screen.getByRole('region', { name: 'List' })
    const detail = screen.getByRole('region', { name: 'Editor' })
    expect(list.parentElement).toHaveClass('twopane', 'twopane--list')
    expect(within(list).getByRole('heading', { name: 'Evaluations' })).toBeInTheDocument()
    expect(
      await within(list).findByText('No evaluations yet. Start with New evaluation.'),
    ).toBeInTheDocument()
    expect(within(detail).getByRole('heading', { name: 'Welcome, Ana' })).toBeInTheDocument()
  })

  it('renders the profile editor once a profile exists', async () => {
    await profileRepository.save({
      name: 'Ana Silva',
      email: 'ana@example.com',
    })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Welcome, Ana' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Profile' }))
    expect(await screen.findByLabelText('Name (optional)')).toHaveValue('Ana Silva')
  })
})
