# ADR-0026: Two-Factor Authentication (TOTP)

- **Date:** 2026-07-06
- **Status:** Proposed (stub — deferred from ADR-0017 Decision B2)
- **Deciders:** Hennadii Shvedko (owner), Claude (architect)

## Context

ADR-0017 (Decision B2) removed the dead "Enable 2FA" toggle from the user
settings page rather than ship half-built two-factor auth. `User.twoFactorEnabled
Boolean @default(false)` exists in the schema but is dormant: there is no TOTP
secret storage, no backup codes, no enrollment/QR flow, no challenge step in the
NextAuth credentials sign-in, and no recovery UX. A dead toggle is worse than an
honest absence; this ADR is where real 2FA gets designed and built.

## Scope to decide when picked up

- **Secret storage**: encrypt the TOTP shared secret at rest with the ADR-0006
  AES-256-GCM envelope (a new `User.twoFactorSecret`/backup-codes columns ride an
  ADR-0002 migration). Never store the secret or backup codes in plaintext.
- **Enrollment**: QR + manual-key provisioning (`otpauth://` URI), verify a first
  code before enabling, then reveal one-time backup codes.
- **Challenge**: extend the NextAuth credentials flow (`src/lib/auth/config.ts`)
  with a second step for `twoFactorEnabled` users; decide session semantics for
  the intermediate "password ok, awaiting TOTP" state.
- **Recovery**: single-use backup codes (hashed at rest) + an operator reset path
  (ties into ADR-0012 admin tooling).
- **UI**: rebuild the settings "Security" section with real enroll/disable/
  regenerate-codes actions wired to new `/api/user/2fa/**` endpoints.

## Related ADRs

- ADR-0006 (secret encryption — prerequisite), ADR-0003 (route conventions),
  ADR-0005 (rate-limit the challenge), ADR-0012 (admin reset path),
  ADR-0017 (removed the placeholder toggle; owns the settings UI this extends),
  ADR-0002 (migration for the new columns).
