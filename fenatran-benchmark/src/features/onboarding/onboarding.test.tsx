import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailField } from '../../components/ui'
import { db } from '../../data/db'
import { profileRepository } from '../../data/repositories/profile'
import type { Profile } from '../../data/types'
import { useProfile } from '../../hooks/useProfile'
import { EditProfile, OnboardingFlow, ProfileGate } from '.'

const persist = vi.fn().mockResolvedValue(true)

beforeEach(async () => {
  await db.profile.clear()
  useProfile.setState({ profile: undefined, failed: false })
  persist.mockClear()
  Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true })
})

const stored: Profile = { name: 'Ana Silva', email: 'ana@example.com' }

describe('EmailField', () => {
  it('masks input, shows a hint and errors, and never suggests a domain', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<EmailField value="" onChange={onChange} hint="Work e-mail" />)
    expect(screen.getByText('Work e-mail')).toBeInTheDocument()
    await user.type(screen.getByLabelText('E-mail'), 'A')
    expect(onChange).toHaveBeenLastCalledWith('a')
    rerender(<EmailField value="ana" onChange={onChange} error="Bad" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Bad')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('OnboardingFlow', () => {
  it('shows every field on one page and requires only the e-mail', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<OnboardingFlow onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Name (optional)')).toBeInTheDocument()
    expect(screen.getByText(/stay on this device until you export them/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText('Enter your e-mail')).toBeInTheDocument()
    await user.type(screen.getByLabelText('E-mail'), 'joão@')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText(/Enter a valid e-mail/)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('E-mail'))
    await user.type(screen.getByLabelText('E-mail'), 'Jose.Silva@Empresa.com.br')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(onDone.mock.calls[0]![0]).toEqual({ name: '', email: 'jose.silva@empresa.com.br' })
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('trims the optional name and rejects a very long one', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<OnboardingFlow onDone={onDone} />)
    await user.type(screen.getByLabelText('E-mail'), 'bo@example.com')
    await user.type(screen.getByLabelText('Name (optional)'), 'x'.repeat(81))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText('Use at most 80 characters')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Name (optional)'))
    await user.type(screen.getByLabelText('Name (optional)'), '  Bo Lí ')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone.mock.calls[0]![0]).toEqual({ name: 'Bo Lí', email: 'bo@example.com' })
  })

  it('edits an existing profile without asking for storage again', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<OnboardingFlow initial={stored} onDone={onDone} />)
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    const name = screen.getByLabelText('Name (optional)')
    await user.clear(name)
    await user.type(name, 'Ana B')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone.mock.calls[0]![0]).toEqual({ name: 'Ana B', email: 'ana@example.com' })
    expect(persist).not.toHaveBeenCalled()
  })
})

describe('ProfileGate', () => {
  it('shows onboarding, persists the profile, then shows content', async () => {
    const user = userEvent.setup()
    render(
      <ProfileGate>
        <p>inside</p>
      </ProfileGate>,
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    await user.type(await screen.findByLabelText('E-mail'), 'bo@example.com')
    await user.type(screen.getByLabelText('Name (optional)'), 'Bo Li')
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText('inside')).toBeInTheDocument()
    expect(await profileRepository.get()).toEqual({ name: 'Bo Li', email: 'bo@example.com' })
  })

  it('shows a read error and retries', async () => {
    const user = userEvent.setup()
    vi.spyOn(profileRepository, 'get').mockRejectedValueOnce(new Error('dexie'))
    render(
      <ProfileGate>
        <p>inside</p>
      </ProfileGate>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read data on this device')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument()
  })

  it('skips onboarding when a profile already exists', async () => {
    await profileRepository.save(stored)
    render(
      <ProfileGate>
        <p>inside</p>
      </ProfileGate>,
    )
    expect(await screen.findByText('inside')).toBeInTheDocument()
  })
})

describe('EditProfile', () => {
  it('saves changes and navigates home', async () => {
    const user = userEvent.setup()
    await profileRepository.save(stored)
    await useProfile.getState().load()
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <EditProfile />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(useProfile.getState().profile).toEqual(stored))
  })

  it('falls back to a blank form when no profile is loaded', () => {
    useProfile.setState({ profile: null })
    render(
      <MemoryRouter>
        <EditProfile />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveValue('')
  })
})
