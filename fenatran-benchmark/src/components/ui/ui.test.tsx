import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  Progress,
  Select,
  Sheet,
  Stepper,
  TextField,
  ToastProvider,
  useToast,
} from '.'

const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => reduced.value }
})

afterEach(() => {
  reduced.value = false
  vi.useRealTimers()
})

describe('Icon', () => {
  it('is hidden from assistive tech without a label', () => {
    const { container } = render(<Icon name="add" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes a label when given', () => {
    render(<Icon name="close" label="Close" size={16} />)
    expect(screen.getByRole('img', { name: 'Close' })).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('fires onClick and defaults to type button', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('applies variant, full width, icon and extra class', () => {
    render(
      <Button variant="danger" fullWidth icon="delete" className="x">
        Remove
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveClass('btn--danger', 'btn--full', 'x')
    expect(button.querySelector('.icon')).toBeInTheDocument()
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('TextField', () => {
  it('links label to input and shows a hint', () => {
    render(<TextField label="Name" hint="Full name" />)
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Full name')
  })

  it('shows an error and marks the input invalid', () => {
    render(<TextField label="E-mail" error="Invalid" id="mail" />)
    expect(screen.getByLabelText('E-mail')).toBeInvalid()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid')
  })

  it('renders without hint or error', () => {
    render(<TextField label="Plain" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Select', () => {
  it('lists options with a placeholder and reports changes', async () => {
    const onChange = vi.fn()
    render(<Select label="Role" options={['A', 'B']} placeholder="Choose" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'B')
    expect(onChange).toHaveBeenCalled()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('shows an error without placeholder', () => {
    render(<Select label="Area" options={['A']} error="Required" id="area" />)
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByLabelText('Area')).toBeInvalid()
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('renders without error', () => {
    render(<Select label="Area" options={['A']} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Checkbox', () => {
  it('toggles', async () => {
    render(<Checkbox label="I agree" />)
    const box = screen.getByLabelText('I agree')
    await userEvent.click(box)
    expect(box).toBeChecked()
  })
})

describe.each([
  ['Dialog', Dialog],
  ['Sheet', Sheet],
])('%s', (_name, Component) => {
  function Harness({ withActions }: { withActions: boolean }) {
    const [open, setOpen] = useState(true)
    return (
      <Component
        open={open}
        title="Confirm"
        onClose={() => setOpen(false)}
        actions={withActions ? <Button>OK</Button> : undefined}
      >
        <p>Body</p>
      </Component>
    )
  }

  it('renders an accessible modal with actions', () => {
    render(<Harness withActions />)
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })

  it('renders without actions', () => {
    render(<Harness withActions={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    render(<Harness withActions />)
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('ignores other keys', async () => {
    render(<Harness withActions />)
    await userEvent.keyboard('a')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on backdrop click but not on panel click', async () => {
    render(<Harness withActions />)
    await userEvent.click(screen.getByText('Body'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('overlay-backdrop'))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not listen for keys while closed', () => {
    const onClose = vi.fn()
    render(
      <Component open={false} title="Hidden" onClose={onClose}>
        x
      </Component>,
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('falls back to a fade with reduced motion', () => {
    reduced.value = true
    render(<Harness withActions />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Progress and Stepper', () => {
  it('clamps the value', () => {
    const { rerender } = render(<Progress value={150} label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<Progress value={-5} label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('handles a zero max', () => {
    render(<Progress value={1} max={0} label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('shows the step position', () => {
    render(<Stepper current={2} total={5} />)
    expect(screen.getAllByText('Step 2 of 5').length).toBeGreaterThan(0)
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 5' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
  })
})

describe('EmptyState', () => {
  it('renders title, text and action', () => {
    render(<EmptyState title="Nothing" text="Add one" action={<Button>Add</Button>} />)
    expect(screen.getByRole('heading', { name: 'Nothing' })).toBeInTheDocument()
    expect(screen.getByText('Add one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('renders with only a title and custom icon', () => {
    render(<EmptyState title="Empty" icon="info" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Toast', () => {
  function Trigger({ kind }: { kind?: 'info' | 'success' | 'error' }) {
    const toast = useToast()
    return <button onClick={() => toast.show('Saved', kind)}>show</button>
  }

  it.each([undefined, 'success', 'error'] as const)(
    'shows a %s toast and dismisses it',
    async (kind) => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      render(
        <ToastProvider>
          <Trigger kind={kind} />
        </ToastProvider>,
      )
      await userEvent.click(screen.getByText('show'))
      expect(screen.getByText('Saved')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100)
      })
      await vi.waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument())
    },
  )

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('useToast must be used inside ToastProvider')
    spy.mockRestore()
  })
})
