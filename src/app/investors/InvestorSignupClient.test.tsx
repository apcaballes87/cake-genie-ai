import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InvestorSignupClient from './InvestorSignupClient'

describe('InvestorSignupClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the requested title, description, email field, and send button', () => {
    render(<InvestorSignupClient />)

    expect(screen.getByRole('heading', { name: "Follow Genie.ph's Journey!" })).toBeInTheDocument()
    expect(screen.getByText('Receive occasional updates on our growth, product progress, and milestones.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('submits the email and confirms a successful signup', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<InvestorSignupClient />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
      target: { value: 'investor@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'investor@example.com' }),
      })
    })
    expect(await screen.findByText("You're on the list. We’ll keep you posted on Genie.ph’s journey.")).toBeInTheDocument()
  })
})
