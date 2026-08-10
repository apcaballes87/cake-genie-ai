'use client'

import { FormEvent, useState } from 'react'
import { Loader2, Send } from 'lucide-react'

export default function InvestorSignupClient() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    try {
      const response = await fetch('/api/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to save your email right now. Please try again later.')
      }

      setEmail('')
      setIsSuccess(true)
      setMessage("You're on the list. We’ll keep you posted on Genie.ph’s journey.")
    } catch (error) {
      setIsSuccess(false)
      setMessage(error instanceof Error ? error.message : 'Unable to save your email right now. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16 sm:px-8">
      <section className="w-full max-w-xl rounded-3xl border border-purple-100 bg-white p-8 text-center shadow-xl shadow-purple-950/5 sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-purple-600">Genie.ph</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Follow Genie.ph&apos;s Journey!</h1>
        <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
          Receive occasional updates on our growth, product progress, and milestones.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row" noValidate>
          <label className="sr-only" htmlFor="investor-email">Email address</label>
          <input
            id="investor-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            required
            disabled={isSubmitting}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-purple-400"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-5 w-5" aria-hidden="true" />}
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </form>

        <p className="mt-4 min-h-6 text-sm" aria-live="polite">
          {message && <span className={isSuccess ? 'text-emerald-700' : 'text-red-600'}>{message}</span>}
        </p>
      </section>
    </main>
  )
}
