import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CartDateOption from '../CartDateOption'

describe('CartDateOption', () => {
  it('selects an available date from the main date button', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onUnavailableInteract = vi.fn()

    render(
      <CartDateOption
        date="2026-06-23"
        day="23"
        month="Jun"
        dayOfWeek="Tuesday"
        isSelected={false}
        isDisabled={false}
        reason={null}
        isTooltipVisible={false}
        tooltipPositionClass="left-0"
        arrowPositionClass="left-8"
        onSelect={onSelect}
        onUnavailableInteract={onUnavailableInteract}
        onUnavailableHoverStart={vi.fn()}
        onUnavailableHoverEnd={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button'))

    expect(onSelect).toHaveBeenCalledWith('2026-06-23')
    expect(onUnavailableInteract).not.toHaveBeenCalled()
  })

  it('keeps unavailable dates visually disabled and exposes a separate reason trigger', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onUnavailableInteract = vi.fn()

    render(
      <CartDateOption
        date="2026-06-23"
        day="23"
        month="Jun"
        dayOfWeek="Tuesday"
        isSelected={false}
        isDisabled={true}
        reason="Requires a 2 day lead time."
        isTooltipVisible={false}
        tooltipPositionClass="left-0"
        arrowPositionClass="left-8"
        onSelect={onSelect}
        onUnavailableInteract={onUnavailableInteract}
        onUnavailableHoverStart={vi.fn()}
        onUnavailableHoverEnd={vi.fn()}
      />,
    )

    const [disabledDateButton, reasonTrigger] = screen.getAllByRole('button')
    expect(disabledDateButton).toBeDisabled()

    await user.click(reasonTrigger)

    expect(onUnavailableInteract).toHaveBeenCalledWith(
      '2026-06-23',
      'Requires a 2 day lead time.',
    )
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows the unavailable tooltip copy when requested', () => {
    render(
      <CartDateOption
        date="2026-06-23"
        day="23"
        month="Jun"
        dayOfWeek="Tuesday"
        isSelected={false}
        isDisabled={true}
        reason="Requires a 2 day lead time."
        isTooltipVisible={true}
        tooltipPositionClass="left-0"
        arrowPositionClass="left-8"
        onSelect={vi.fn()}
        onUnavailableInteract={vi.fn()}
        onUnavailableHoverStart={vi.fn()}
        onUnavailableHoverEnd={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Requires a 2 day lead time.')).toHaveLength(2)
  })
})
