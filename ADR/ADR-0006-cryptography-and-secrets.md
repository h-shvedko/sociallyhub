# ADR-0006: Cryptography, Token Encryption, and Secrets Management

- **Date:** 2026-07-02
- **Status:** Accepted
- **Deciders:** Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub stores third-party credentials in PostgreSQL — social platform OAuth tokens, workspace-level "bring your own app" API keys, integration credentials, and (soon, per ADR-0019) Stripe-adjacent configuration. The 2026-07-02 audit found that every layer of this story is broken, and the code confirms it:

**1. `src/lib/encryption.ts` cannot round-trip data on any Node version.**

- It calls the long-deprecated `crypto.createCipher(ALGORITHM, key)` with `ALGORITHM = 'aes-256-gcm'` (line 17) and `crypto.createDecipher` (line 42). On Node ≥ 22, `createCipher`/`createDecipher` are **removed** — verified locally on v23.7.0: `TypeError: crypto.createCipher is not a function`, so both encrypt and decrypt throw. On Node 20 (the runtime in `Dockerfile.dev`/`Dockerfile.prod`, both `node:20-alpine`), encryption produces ciphertext but the GCM auth tag is never captured (`cipher.getAuthTag()` is never called), and decryption via `createDecipher` never calls `setAuthTag`, so `decipher.final()` unconditionally throws. **Every `PlatformCredentials` row ever written was write-only: decryption has never succeeded.**
- `encryptCredentials` generates a random 16-byte IV (line 16) and stores it in the output object, but never passes it to the cipher — `createCipher` derives its own key+IV from the password via OpenSSL's `EVP_BytesToKey` (MD5, one iteration, no salt). The stored `iv` field is decorative.
- The key falls back to a hardcoded string: `process.env.ENCRYPTION_KEY || 'sociallyhub-default-key-32bytes!!'` (line 4), then `slice(0, 32).padEnd(32, '0')` — silent truncation/padding of whatever is supplied.
- `ENCRYPTION_KEY` appears nowhere else in the repository: not in `.env.example`, not in `docker-compose.yml`, not in `k8s/secrets.yaml`. Every environment silently uses the hardcoded fallback.

**2. Data the schema promises is encrypted is stored in plaintext.**

- `SocialAccount.accessToken` / `refreshToken` carry `// Encrypted` comments (`prisma/schema.prisma` lines 365–366), but `src/app/api/accounts/callback/route.ts` writes `accountData.accessToken` / `accountData.refreshToken` straight into the rows on both the update and create paths.
- `IntegrationSetting.credentials` is commented `// Encrypted credentials` (schema line 5288), but `src/app/api/admin/settings/integrations/route.ts` (POST, line 202) and `.../integrations/[id]/route.ts` (PUT, lines 144–146) persist the raw request-body JSON. The routes mask credentials as `'***HIDDEN***'` in responses — display masking, not encryption at rest.
- `SSOProvider.clientSecret` (line 5172) and `SSOAccount.accessToken`/`refreshToken` (lines 5194–5195) carry the same `// Encrypted` comments with no encryption call sites anywhere.

**3. The OAuth `state` parameter is unauthenticated.**

`src/app/api/accounts/connect/route.ts` (line 78) builds `state = JSON.stringify({ workspaceId, userId, provider })` and appends it URL-encoded; `src/app/api/accounts/callback/route.ts` (line 29) does `JSON.parse(decodeURIComponent(state))` and trusts `workspaceId`/`userId` from it. Anyone completing an OAuth flow can rewrite `state` to bind the resulting account (and its tokens) to an arbitrary workspace, and there is no CSRF nonce or expiry.

**4. Secrets hygiene is inconsistent.**

`k8s/secrets.yaml` contains checked-in base64 "placeholder" secrets (`NEXTAUTH_SECRET: please-replace-with-actual-secret`, `POSTGRES_PASSWORD: password`, `REDIS_PASSWORD: redispassword`) with no `ENCRYPTION_KEY` entry at all. `.env.example` exists and is reasonably complete for platform API keys but omits `ENCRYPTION_KEY`. The seeder writes fake token strings (`encrypted-token-NNN`) into `SocialAccount` rows, and demo credentials are printed by scripts and pages (handled in ADR-0025).

We must decide how encryption at rest, key management/rotation, OAuth state integrity, and the secrets contract will work — in a way compatible with the self-hosted Docker deployment standardized in ADR-0022.

## Decision Drivers

- **Fail closed:** a missing key must stop the system loudly, never silently downgrade to a hardcoded key.
- **Recoverability:** ciphertext must be self-describing enough to survive key rotation and future algorithm changes without table rewrites.
- **Deployment reality (ADR-0022):** self-hosted Docker Compose now, optional k8s later. No cloud KMS can be assumed; solutions requiring one are disqualified as the baseline.
- **Operational weight:** single-owner project; a Vault cluster is not maintainable here.
- **Forward compatibility:** must work identically on Node 20 and Node ≥ 22.
- **Blast-radius honesty:** existing `PlatformCredentials` ciphertexts are unrecoverable by construction (see Context); the design must not pretend otherwise.
- **Near-term consumers:** ADR-0009 (real social publishing needs readable tokens from the DB), ADR-0019 (Stripe webhook/API secrets), ADR-0016 (IntegrationSetting operations).

## Considered Options

### Option 1 — Rewrite application-level crypto on Node `crypto` (AES-256-GCM, versioned ciphertext, env-provided keys)

Rewrite `src/lib/encryption.ts` on `createCipheriv`/`createDecipheriv`, random 12-byte IV, auth tag stored alongside ciphertext, key IDs embedded in a versioned ciphertext string, mandatory `ENCRYPTION_KEY` env, rotation via a previous-key slot plus a batch re-encrypt script.

- **Pros:** zero new dependencies or services; works in Compose, k8s, and CI identically; auditable in ~150 lines; versioned format makes rotation and future KMS envelope-wrapping a non-breaking change.
- **Cons:** the key lives in process env — an attacker with full host/container access can read it (true of any non-HSM design); rotation is our responsibility.

### Option 2 — External KMS / Vault transit encryption

Envelope encryption via AWS KMS / GCP KMS, or HashiCorp Vault's transit engine.

- **Pros:** keys never touch application memory in exportable form; audit logging; managed rotation.
- **Cons:** contradicts ADR-0022's self-hosted baseline (cloud KMS) or adds a stateful HA service with its own unseal-key ceremony (Vault) to a single-owner deployment; per-request network latency on every token read in the publishing pipeline. Disproportionate today.

### Option 3 — Database-level encryption only (pgcrypto / encrypted volumes)

Encrypt in Postgres with `pgcrypto`, or rely on disk/volume encryption.

- **Pros:** no application code changes; transparent.
- **Cons:** with `pgcrypto` the key appears in SQL text (query logs, `pg_stat_statements`); volume encryption protects against stolen disks, not against the primary realistic threats — SQL injection, exposed backups/dumps, or the checked-in `postgres/password` k8s credentials. Does not solve OAuth state signing or the secrets contract at all.

### Option 4 — Adopt a third-party field-encryption library (e.g. `@47ng/cloak`, Prisma field-encryption middleware)

- **Pros:** declarative per-field encryption, key rotation built in.
- **Cons:** adds a dependency on a small-maintainer package for the most security-critical code path; Prisma middleware-based variants interact poorly with the raw-query paths and the invalid-schema remediation in ADR-0002; the underlying primitive is the same AES-256-GCM we can write directly.

## Decision Outcome

**Chosen: Option 1** — application-level AES-256-GCM on Node's `crypto` with versioned ciphertext and env-provided keys. It is the only option consistent with ADR-0022's self-hosted baseline, has no new operational surface, and its versioned format leaves a clean upgrade path to Option 2 (wrap the data key with a KMS later) if the project outgrows it.

### Specification

**Ciphertext format (string, storable in existing `String`/`Json` columns):**

```
enc:v1:<keyId>:<iv_b64url>:<ciphertext_b64url>:<authTag_b64url>
```

- `v1` = AES-256-GCM, 12-byte random IV per encryption, 16-byte auth tag.
- `keyId` = short identifier (`k1`, `k2`, …) naming which key encrypted the value.
- The `enc:` prefix makes plaintext-vs-ciphertext detection trivial during migration (no legitimate OAuth token begins with `enc:v1:`).

**Key management:**

- `ENCRYPTION_KEY` (required): 64 hex chars = 32 bytes, generated with `openssl rand -hex 32`. This is `k1`.
- `ENCRYPTION_KEY_PREVIOUS` (optional): same format; used for decrypt-only during rotation (`k0` semantics — the keyId embedded in ciphertext selects the key, current key is always used for new encryptions).
- **No fallback key, ever.** If `ENCRYPTION_KEY` is missing or malformed, `getKey()` throws. Validation is lazy (first encrypt/decrypt call) so `next build` — which evaluates route modules — does not require production secrets; additionally `docker/entrypoint.sh` and `/api/health` assert the key's presence/shape at startup so misconfiguration fails deployment, not the first user request.

**Key rotation story:** set `ENCRYPTION_KEY_PREVIOUS` to the old key, `ENCRYPTION_KEY` to the new one, deploy, run `scripts/rotate-encryption-key.ts` (decrypt-with-embedded-keyId → re-encrypt-with-current in batches, per table), verify no rows reference the old keyId, remove `ENCRYPTION_KEY_PREVIOUS`. Writes always use the current key, so rotation also happens opportunistically on any update.

**Fields brought under encryption (all via the one helper):**

| Model.field | Current state | Action |
|---|---|---|
| `PlatformCredentials.clientSecret` / `accessToken` / `refreshToken` | "encrypted" with broken scheme; **unrecoverable** | Null out, set `isConfigured=false`; owners re-enter credentials. Nothing is lost — decryption never worked. |
| `SocialAccount.accessToken` / `refreshToken` | plaintext | Batch re-encryption migration + read-side format detection (below) |
| `IntegrationSetting.credentials` (and `webhookSecret`) | raw JSON despite comment | Encrypt on write in both admin integration routes; batch-encrypt existing rows |
| `SSOProvider.clientSecret`, `SSOAccount.accessToken`/`refreshToken` | plaintext, commented "Encrypted" | Encrypt when the SSO subsystem is wired (no active write path today); helper ready |

**Migration for existing `SocialAccount` rows — batch-first with lazy fallback:** a one-shot script (`scripts/encrypt-social-tokens.ts`) rewrites every row whose token lacks the `enc:` prefix. Because deploys are not atomic with the script run, the read helper `decryptToken()` also accepts non-prefixed values and returns them as-is (logging a warning) during a bounded transition window; any write re-encrypts. Seeded fake tokens (`encrypted-token-NNN` from `prisma/seed.ts`) get encrypted like any other value — they are indistinguishable from real tokens to the storage layer; their demo semantics are ADR-0025's concern. After the window (one release), the plaintext fallback is removed and non-prefixed tokens are treated as errors that flip the account to `TOKEN_EXPIRED`.

**OAuth state signing:** replace the bare JSON with a compact signed token issued by a new `src/lib/oauth-state.ts`:

```
base64url(JSON{workspaceId, userId, provider, nonce, iat}) + '.' + base64url(HMAC-SHA256(payload))
```

- HMAC key derived via HKDF from `NEXTAUTH_SECRET` with `info: 'oauth-state'` (no new secret to manage; distinct from any other NEXTAUTH_SECRET use).
- Callback (`/api/accounts/callback`) verifies the MAC with `crypto.timingSafeEqual`, rejects if `iat` older than 10 minutes, and only then trusts `workspaceId`/`userId`. This closes the workspace-binding forgery in Context §3. (Full PKCE repair for Twitter's hardcoded `'mock_code_challenge'` belongs to ADR-0009 but must use `crypto.randomBytes`, not this module.)

**Secrets contract:**

- `.env.example` is the canonical, exhaustive env contract (reaffirming ADR-0022). Add `ENCRYPTION_KEY` with a generation comment; every new secret-bearing feature (Stripe keys per ADR-0019, VAPID, Twilio) must land with its `.env.example` entry in the same PR.
- `k8s/secrets.yaml` is deleted and replaced by `k8s/secrets.example.yaml` containing **empty** values plus creation instructions (`kubectl create secret generic ... --from-env-file`); `k8s/secrets.yaml` goes into `.gitignore`. The checked-in placeholders were never real secrets, so no git-history rewrite is required — but because `postgres`/`redispassword` are plausible-looking, any environment that actually applied this manifest must rotate those passwords.
- Demo credentials (`demo@sociallyhub.com` / `demo123456`, seeded `password123` users) remain out of scope here and are governed by ADR-0025 (explicit demo mode); this ADR only requires that demo mode never weakens the key requirement — `ENCRYPTION_KEY` is mandatory in every mode, including demo and CI (CI generates a throwaway key).
- Secret values must never be logged; the existing `maskCredentials()` display-masking in `src/lib/encryption.ts` is retained for UI/API responses (see ADR-0023 for log redaction).

## Consequences

### Positive

- Encryption round-trips for the first time in the project's history, on Node 20 and Node ≥ 22 alike, with authenticated (tamper-evident) ciphertext.
- No silent hardcoded-key fallback; misconfigured deployments fail at startup with an actionable error.
- Social OAuth tokens, integration credentials, and BYO platform keys are unreadable in DB dumps and backups — the schema's `// Encrypted` comments become true.
- OAuth account connection can no longer be bound to a foreign workspace via a forged `state`.
- Versioned ciphertext gives a rotation procedure today and a KMS-envelope path later without data migration.
- One canonical env contract (`.env.example`) and no checked-in secret manifests.

### Negative

- Losing `ENCRYPTION_KEY` makes encrypted columns permanently unreadable. Mitigation: tokens are re-obtainable (users reconnect accounts; credentials re-entered), but this is a real operational hazard requiring documented key backup.
- Existing `PlatformCredentials` rows are invalidated and must be re-entered by workspace owners (unavoidable — they were never decryptable).
- Every token read pays a decrypt cost (microseconds; negligible next to the network calls that consume the tokens).
- Encrypted columns cannot be queried/filtered by value in SQL. No current query does this; future features must key on non-secret columns.
- A short dual-format window exists for `SocialAccount` tokens; the read-side plaintext fallback must actually be removed after one release or it becomes a permanent downgrade path.

## Implementation Plan

**Phase 1 — Core crypto rewrite (P0, blocks ADR-0009 and ADR-0016 work)**

1. **(M)** Rewrite `src/lib/encryption.ts`: `encryptString`/`decryptString` implementing the `enc:v1` format with `createCipheriv`/`createDecipheriv` (AES-256-GCM, 12-byte IV, auth tag); `encryptCredentials`/`decryptCredentials` become JSON wrappers over them (signature-compatible for the platform-credentials routes); lazy key loading from `ENCRYPTION_KEY`/`ENCRYPTION_KEY_PREVIOUS` with strict 64-hex validation and **no default**; keep `maskCredentials` as-is.
2. **(S)** Add `ENCRYPTION_KEY` (+ commented `ENCRYPTION_KEY_PREVIOUS`) to `.env.example` with `openssl rand -hex 32` instructions; add generated keys to `docker-compose.yml` env for dev and to CI workflow env.
3. **(S)** Startup assertion: extend `docker/entrypoint.sh` and `src/app/api/health/route.ts` to verify key presence/format (health reports `encryption: ok|misconfigured` without leaking material).
4. **(S)** Unit tests: round-trip, tamper detection (flipped tag byte throws), wrong key throws, missing env throws, previous-key decryption works — the first real content for the `__tests__/unit` directory that `jest.config.js` already references (ADR-0021).

**Phase 2 — OAuth state integrity (P0, small and independent)**

5. **(S)** New `src/lib/oauth-state.ts`: `signState(payload)` / `verifyState(token)` per spec (HKDF from `NEXTAUTH_SECRET`, 10-minute expiry, `timingSafeEqual`).
6. **(S)** Use it in `src/app/api/accounts/connect/route.ts` (issue) and `src/app/api/accounts/callback/route.ts` (verify before trusting `workspaceId`/`userId`; redirect with `error=invalid_state` on failure).

**Phase 3 — Encrypt SocialAccount tokens (P1)**

7. **(S)** Add `encryptToken`/`decryptToken` helpers (thin wrappers with the transitional plaintext fallback + warning log).
8. **(M)** Encrypt on write in `src/app/api/accounts/callback/route.ts` (both update and create branches) and in the demo-account creation path of `src/app/api/accounts/connect/route.ts`; decrypt at the read sites that hand tokens to providers (`/api/social/post`, `/api/social/analytics`, the account-loading fix from ADR-0009, and `src/lib/jobs/processors/post-scheduling.ts` when ADR-0008 wires workers).
9. **(M)** `scripts/encrypt-social-tokens.ts`: batch-encrypt all non-`enc:`-prefixed `accessToken`/`refreshToken` values; idempotent; reports counts. Run as a release step (ADR-0002's migration-first workflow governs any schema tweaks; none are needed — column types stay `String`).
10. **(S)** Follow-up (next release): remove the plaintext fallback; unknown formats set `SocialAccountStatus.TOKEN_EXPIRED`.

**Phase 4 — IntegrationSetting and PlatformCredentials cleanup (P1)**

11. **(M)** Encrypt `credentials` (and `webhookSecret`) in `src/app/api/admin/settings/integrations/route.ts` POST and `.../[id]/route.ts` PUT; decrypt in `.../[id]/test/route.ts` where connectivity tests need real values; keep `'***HIDDEN***'` response masking. Batch-encrypt existing rows in the same script pattern as step 9.
12. **(S)** One-off cleanup in `scripts/`: null out legacy `PlatformCredentials` secret fields and set `isConfigured=false`; the `/api/platform-credentials` routes keep working via the signature-compatible helpers from step 1, now actually able to decrypt what they encrypt.

**Phase 5 — Secrets hygiene (P1)**

13. **(S)** Replace `k8s/secrets.yaml` with `k8s/secrets.example.yaml` (empty values + `ENCRYPTION_KEY` entry + creation instructions); gitignore the real file; add rotation note for any environment that applied the old placeholders.
14. **(S)** Sweep for remaining hardcoded secret literals (`git grep` for the old fallback key string, `sociallyhub_dev_password` outside compose, etc.) and document each remaining intentional dev-only credential in `.env.example` comments; demo-credential policy defers to ADR-0025.

## Risks and Mitigations

- **Key loss bricks encrypted columns.** Mitigate: README/ops doc requires the key be stored in the owner's password manager at generation time; all encrypted data is recoverable by re-authentication (OAuth reconnect, credential re-entry), so worst case is user inconvenience, not data loss.
- **Module-load throw breaks `next build` or tooling.** Mitigate: key validation is lazy (first use) with the startup assertion living in the entrypoint/health check, not at import time; CI sets a throwaway key anyway.
- **Migration script runs against half-deployed code (plaintext written after batch ran).** Mitigate: transitional read fallback (step 7) plus re-running the idempotent script; fallback removal only after verification query shows zero non-prefixed tokens.
- **Rotation partially applied across tables.** Mitigate: rotation script processes all encrypted tables and prints per-keyId row counts; `ENCRYPTION_KEY_PREVIOUS` stays configured until counts hit zero.
- **HMAC key coupling to `NEXTAUTH_SECRET`** (rotating it invalidates in-flight OAuth states). Accepted: states live ≤ 10 minutes; a NEXTAUTH_SECRET rotation already invalidates all sessions, so the marginal impact is nil.
- **Placeholder k8s secrets were applied somewhere real.** Mitigate: step 13's rotation note; ADR-0022 owns the deployment checklist that enforces it.

## Related ADRs

- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — governs any schema changes; this ADR deliberately needs none (encrypted values fit existing `String`/`Json` columns), but batch scripts follow its release-step discipline.
- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — the routes touched here follow its session/workspace validation conventions.
- **ADR-0005: API Security Hardening** — sibling decision; this ADR covers data-at-rest and OAuth-state integrity, ADR-0005 covers transport/headers/caching (including the `Cache-Control: public` on `/api/*` hazard).
- **ADR-0008: Background Jobs and the Publishing Pipeline** — the post-scheduling worker becomes a consumer of `decryptToken`.
- **ADR-0009: Social Platform Integration Completion Strategy** — depends on Phases 1–3 here: real publishing requires DB-loaded, decryptable tokens and a trustworthy OAuth callback; PKCE repair lands there.
- **ADR-0016: System Settings & Configuration** — `IntegrationSetting` operations build on Phase 4.
- **ADR-0019: Billing and Subscriptions with Stripe** — Stripe secret/webhook keys enter via the `.env.example` contract established here (env-held, never DB-held).
- **ADR-0021: Testing Strategy and Honest Quality Gates** — crypto unit tests seed the `__tests__/unit` project.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — deployment baseline that drove Option 1; owns secret *delivery* (env files, k8s secret creation), while this ADR owns secret *format and use*.
- **ADR-0023: Observability** — log redaction rules for secret material.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — owns demo credentials and seeded fake tokens; this ADR only constrains it (no key-requirement bypass in demo mode).
