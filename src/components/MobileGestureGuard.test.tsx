import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileGestureGuard from './MobileGestureGuard'

const originalMatchMedia = window.matchMedia

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(max-width: 767px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('MobileGestureGuard', () => {
  afterEach(() => {
    document.body.className = ''
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    })
  })

  it('prevents multi-touch zoom gestures on mobile when image zoom is closed', () => {
    mockMatchMedia(true)
    render(<MobileGestureGuard />)

    const touchMoveEvent = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(touchMoveEvent, 'touches', {
      configurable: true,
      value: [{ identifier: 1 }, { identifier: 2 }],
    })

    document.dispatchEvent(touchMoveEvent)

    expect(touchMoveEvent.defaultPrevented).toBe(true)
  })

  it('leaves multi-touch zoom alone while the shared image zoom modal is open', () => {
    mockMatchMedia(true)
    document.body.classList.add('genie-image-zoom-open')

    render(<MobileGestureGuard />)

    const touchMoveEvent = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(touchMoveEvent, 'touches', {
      configurable: true,
      value: [{ identifier: 1 }, { identifier: 2 }],
    })

    document.dispatchEvent(touchMoveEvent)

    expect(touchMoveEvent.defaultPrevented).toBe(false)
  })
})
