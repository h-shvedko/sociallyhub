// Public share surface shell (ADR-0020 Phase 1 item 4).
//
// ANONYMOUS BY DESIGN: this layout (and everything under src/app/share/**)
// must never import the auth module ('@/lib/auth', next-auth) — enforced by
// an eslint no-restricted-imports zone. No dashboard chrome, no session
// usage: just a plain centered container. Global CSS is already imported by
// the root layout this nests inside — do not re-import it here.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shared Report',
  // Tokenized share links must never end up in a search index.
  robots: { index: false, follow: false },
}

export default function ShareLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-6">
        {children}
      </main>
    </div>
  )
}
