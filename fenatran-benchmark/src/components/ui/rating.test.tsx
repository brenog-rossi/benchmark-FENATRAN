import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RatingScale } from './RatingScale'
import { TextArea } from './TextArea'

function ControlledRating({ onChange }: { onChange: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null)
  return (
    <RatingScale
      label="Comfort"
      value={value}
      onChange={(next) => {
        onChange(next)
        setValue(next)
      }}
    />
  )
}

describe('RatingScale', () => {
  it('renders 0 to 5 options and a "Not scored" hint by default', () => {
    render(<RatingScale label="Comfort" value={null} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Comfort' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['0', '1', '2', '3', '4', '5'])
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    expect(screen.getByText('Not scored')).toBeInTheDocument()
  })

  it('selects a value and clears it when the selected value is clicked again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledRating onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '3' }))
    expect(onChange).toHaveBeenLastCalledWith(3)
    expect(screen.getByRole('radio', { name: '3' })).toBeChecked()
    expect(screen.getByText('Score 3')).toBeInTheDocument()
    expect(screen.getByText('3').closest('label')).toHaveClass('rating__option--on')

    await user.click(screen.getByRole('radio', { name: '3' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('Not scored')).toBeInTheDocument()
  })

  it('does not clear when clicking a different value', async () => {
    const onChange = vi.fn()
    render(<RatingScale label="Comfort" value={2} onChange={onChange} />)
    await userEvent.setup().click(screen.getByRole('radio', { name: '4' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('shows custom range with min and max labels', () => {
    render(
      <RatingScale
        label="Noise"
        value={1}
        onChange={() => {}}
        min={1}
        max={3}
        minLabel="Poor"
        maxLabel="Great"
      />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByText(/1 = Poor, 3 = Great/)).toBeInTheDocument()
    expect(screen.getByText(/Score 1/)).toBeInTheDocument()
  })

  it('omits the range text when only one label is given', () => {
    render(<RatingScale label="Noise" value={null} onChange={() => {}} minLabel="Poor" />)
    expect(screen.queryByText(/Poor/)).not.toBeInTheDocument()
  })
})

describe('TextArea', () => {
  it('links label, uses default rows and has no error state', () => {
    render(<TextArea label="Comments" />)
    const area = screen.getByLabelText('Comments')
    expect(area.tagName).toBe('TEXTAREA')
    expect(area).toHaveAttribute('rows', '3')
    expect(area).not.toHaveAttribute('aria-invalid')
    expect(area).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('uses a given id, rows and shows an error', async () => {
    const onChange = vi.fn()
    render(<TextArea label="Notes" id="notes" rows={5} error="Required" onChange={onChange} />)
    const area = screen.getByLabelText('Notes')
    expect(area).toHaveAttribute('id', 'notes')
    expect(area).toHaveAttribute('rows', '5')
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveAttribute('aria-describedby', 'notes-error')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'notes-error')
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
    await userEvent.setup().type(area, 'x')
    expect(onChange).toHaveBeenCalled()
  })
})
