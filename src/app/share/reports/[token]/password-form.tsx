'use client'

// Password gate for a protected share link (ADR-0020 Phase 1 item 4).
//
// Posts { password } to the public verify endpoint; on success the server
// sets the short-lived HMAC-signed HttpOnly access cookie and router.refresh()
// re-renders the server page, which now sees the valid cookie and renders the
// snapshot. This file never imports the auth module — anonymous by design.

import * as React from 'react'
import { useRouter } from 'next/navigation'

export function SharePasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/share/reports/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // Cookie is set; re-run the server component, which now unlocks.
        router.refresh()
        return
      }
      if (res.status === 401) {
        setError('Invalid password')
      } else if (res.status === 429) {
        setError('Too many attempts. Please wait a moment and try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full justify-center py-16">
      <form
        onSubmit={handleSubmit}
        data-testid="share-password-form"
        className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold">This report is password protected</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the password you received to view this report.
        </p>
        <label htmlFor="share-password" className="mt-4 block text-sm font-medium">
          Password
        </label>
        <input
          id="share-password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          data-testid="share-password-submit"
          disabled={submitting || password.length === 0}
          className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Checking…' : 'View report'}
        </button>
      </form>
    </div>
  )
}
