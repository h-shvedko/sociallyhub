/**
 * Demo Mode Configuration (ADR-0025 D1 — the ONE demo switch).
 *
 * Demo mode is governed by a SINGLE explicit flag: `DEMO_MODE=true`.
 * Absent means OFF, everywhere — including development. There is no
 * NODE_ENV heuristic and no `ENABLE_DEMO` backdoor anymore (both removed);
 * a production build never fabricates data unless an operator sets DEMO_MODE.
 *
 * SERVER-ONLY: `isDemoMode()` reads `process.env.DEMO_MODE`, which is not a
 * `NEXT_PUBLIC_*` variable, so it is only meaningful in server code (route
 * handlers, server components, seeders). Client components must receive the
 * flag + hint from a server component wrapper (see `getPublicDemoConfig()`) —
 * never by duplicating the value into a `NEXT_PUBLIC_*` variable that can
 * drift from the real gate (ADR-0025 D1).
 */

/** The one demo gate. `true` only when `DEMO_MODE=true`. */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true'
}

/** The demo login email (display only; the account is created by the demo seed). */
export const DEMO_USER_EMAIL = 'demo@sociallyhub.com'

/**
 * The demo password to show in the credentials hint, sourced from
 * `DEMO_USER_PASSWORD` (the same variable the demo seed uses). Never a
 * committed constant (ADR-0025 D4). Returns null when unset so the hint can
 * degrade honestly instead of printing a fake password.
 */
function demoPasswordHint(): string | null {
  const pw = process.env.DEMO_USER_PASSWORD
  return pw && pw.trim() !== '' ? pw : null
}

/**
 * Server-only: the demo credentials message for the signin hint, or null when
 * demo mode is off. Kept for backward compatibility with existing callers; new
 * client callers should use the flag/hint passed down from a server wrapper.
 */
export function getDemoCredentialsMessage(): string | null {
  if (!isDemoMode()) return null
  const pw = demoPasswordHint()
  return pw
    ? `Use ${DEMO_USER_EMAIL} / ${pw} to sign in`
    : `Use ${DEMO_USER_EMAIL} to sign in (demo password set via DEMO_USER_PASSWORD)`
}

/**
 * The minimal, safe-to-expose demo payload for a server component to hand to a
 * client component. Contains only the flag and the display hint — no secrets
 * beyond the demo password the operator deliberately configured for the
 * showcase account.
 */
export interface PublicDemoConfig {
  demoMode: boolean
  credentialsHint: string | null
}

export function getPublicDemoConfig(): PublicDemoConfig {
  return {
    demoMode: isDemoMode(),
    credentialsHint: getDemoCredentialsMessage(),
  }
}
