# SociallyHub — Architecture Decision Records

This folder is the canonical remediation and evolution plan for SociallyHub, produced from the verified code audit of 2026-07-02 (see the "Current State" section at the top of `CLAUDE.md`). Process rules are in [ADR-0001](ADR-0001-record-architecture-decisions.md).

**Owner decisions binding this set (2026-07-02):** deployment standardizes on self-hosted Docker (Vercel removed) · repair Support + Admin RBAC now, defer Community / Documentation / Discord behind feature flags · Stripe billing is in scope now.

**Progress: 20 of the 24 decision ADRs implemented** (0002–0017, 0019, 0021, 0022, 0024 — foundation → security → pipeline → support/admin, the three deferral flag-offs, real admin settings/backups, user settings/personalization, the hygiene sweep that produced the first-ever green `next build`, and the CI/CD pipeline + buildable production image built on it). The remaining 4 (0018, 0020, 0023, 0025) are proposed-but-not-built. ADR-0001 is the record-keeping process itself (always in effect); ADR-0026/0027 are follow-up stubs filed from ADR-0017.

## Index

### Foundation (prerequisites for everything) — ✅ both implemented
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0002](ADR-0002-prisma-schema-remediation.md) | Prisma Schema Remediation & Migration-First Workflow | ✅ Implemented (2026-07-03) | Fixed all 33 validation errors (kept analytics `UserSession`, deleted the RBAC copy; defined the 15 missing `Documentation*` enums), regenerated the client, baselined the DB, banned `db push`, gated CI on `prisma validate` + migration drift. |
| [0003](ADR-0003-auth-helpers-and-route-conventions.md) | Auth Helper Consolidation & API Route Conventions | ✅ Implemented (2026-07-03) | One canonical `@/lib/auth` module (`getAuthenticatedUser()`/`requireSession()`); codemodded ~330 broken/unawaited call sites across 64 files; migrated 40 legacy dynamic routes to Next 15 async params; zod + single error envelope conventions enforced by ESLint. |

### Security — ✅ all three implemented
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0004](ADR-0004-platform-authorization-model.md) | Platform Authorization Model & RBAC Enforcement | ✅ Implemented (2026-07-03) | Two-tier model: `User.isPlatformAdmin` gates `/api/admin/**` and global settings; `WorkspaceRole` enforced only via central helpers; dropped the never-enforced Role/UserRole/Permission tables. |
| [0005](ADR-0005-api-security-hardening.md) | API Security Hardening | ✅ Implemented (2026-07-04) | Default-deny `withApiAuth` wrapper with CI enforcement (warn mode); endpoint-by-endpoint remediation table (ticket holes, global-config access, unauthenticated writes) closed; removed blanket public Cache-Control on `/api/*`; Redis rate limiting; signed OAuth state. |
| [0006](ADR-0006-cryptography-and-secrets.md) | Cryptography, Token Encryption & Secrets | ✅ Implemented (2026-07-04) | Rewrote `encryption.ts` on AES-256-GCM/`createCipheriv` with versioned ciphertext and mandatory `ENCRYPTION_KEY`; encrypted SocialAccount tokens + IntegrationSetting credentials; signed OAuth state. First successful decryption in the project's history. |

### Core product pipeline — ✅ all four implemented (one foundations-only)
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0007](ADR-0007-media-storage-and-serving.md) | Media Storage, Uploads & Serving | ✅ Phases 0–2 implemented (2026-07-04) | Single storage abstraction (private local-disk now, MinIO/S3 in prod), one upload endpoint, one authenticated serving route; ticket attachments went private. S3/MinIO driver, ClamAV scanning, and the full `/api/images` repurpose deferred to ADR-0022/0008/0024. |
| [0008](ADR-0008-background-jobs-and-publishing.md) | Background Jobs & the Publishing Pipeline | ✅ Implemented (2026-07-04) | Dedicated worker container (`src/worker.ts`, same image); enqueue from `/api/posts` with deterministic job IDs; DB-backed account/token resolution; honest processor success-handling (never fakes success); client-report schedules became repeatable jobs. Real provider posting is ADR-0009. |
| [0009](ADR-0009-social-platform-integrations.md) | Social Platform Integration Completion | ✅ Foundations + honesty implemented (2026-07-04) | Depth-first Twitter/X + Meta: real PKCE, replies, refresh, Meta webhook ingestion (proven end-to-end), honest analytics (all fabricated `generateMockAnalytics` removed), LinkedIn/TikTok/YouTube flagged unavailable, demo fabrication gated. Live posting/media/analytics against real platforms deferred — needs a paid X tier + Meta App Review + real credentials (external dependency, not a defect). |
| [0010](ADR-0010-realtime-and-notifications.md) | Realtime Transport & Notification Delivery | ✅ Implemented (2026-07-06) | SSE from a Next route backed by Redis pub/sub (proven live: event received in real time, persist-first); DB-backed `Notification` model; in-app + email + web-push channels; SMS cut; fastify/socket.io-client removed. Live browser push delivery + nginx SSE tuning deferred. |

### Subsystem repairs and deferrals — ✅ repairs done, ✅ deferral flags built
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0011](ADR-0011-support-subsystem-remediation.md) | Support Subsystem Remediation | ✅ Implemented (2026-07-06) | Repaired in place: support-agents rewritten on `SupportAgent`, invalid `'REPLY'` enum fixed to `AGENT_REPLY`, real emails (Mailhog-verified: reply/contact/ticket-created), seed data (3 agents/12 tickets/1 chat), agents admin page + roster dropdown. Guest ticket access token deferred to ADR-0005 Phase 2. |
| [0012](ADR-0012-admin-rbac-remediation.md) | Admin Dashboard & RBAC Remediation | ✅ Implemented (2026-07-06) | Platform-operator console on `isPlatformAdmin`; fixed the analytics-500 (`lastActiveAt`→`lastActivity`), deleted sso/teams routes, real `GET /api/admin/overview` stats, real user CRUD modal, bulk-ops on `TeamInvitation`+`VerificationToken` reset links (no temp passwords). SSO login flow deferred. |
| [0013](ADR-0013-community-subsystem-deferral.md) | Community Subsystem: Defer | ✅ Deferral implemented (2026-07-06) | `FEATURE_COMMUNITY` flag (default off) enforced by the shared middleware 404ing `/api/community/**` (verified); UI entry points hidden; repair backlog deferred behind un-defer criteria. |
| [0014](ADR-0014-documentation-management-deferral.md) | Documentation Management: Defer | ✅ Deferral implemented (2026-07-06) | `FEATURE_DOCS_MANAGEMENT` flag (default off) 404s `/api/documentation/**` + a `layout.tsx` guard on the docs pages; missing enums already fixed in 0002; default un-defer path is merging docs into the Help Center. |
| [0015](ADR-0015-discord-integration-deferral.md) | Discord Integration: Defer | ✅ Deferral + mock deletion implemented (2026-07-06) | `FEATURE_DISCORD` flag nested under Community's; the hardcoded fake server + mock leaf routes + mock webhook senders **deleted** (zero fabricated data in src); kept the config CRUD + reusable payload interfaces; real integration deferred. |

### Settings, AI, growth — not yet implemented
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0016](ADR-0016-admin-settings-configuration.md) | System Settings: Real Operations over Simulations | ✅ Implemented (2026-07-06) | Real `pg_dump` backups on the worker (verified: real file + matching SHA-256 + COMPLETED record); real flag prerequisite check; deleted the fake audit/optimize/test endpoints (410); dropped `BrandingConfiguration`; rebuilt hub + 5 pages. |
| [0017](ADR-0017-user-settings-and-personalization.md) | User Settings, Personalization & i18n Scope | ✅ Implemented (2026-07-06) | Mounted `SettingsProvider`+next-themes; rewrote `/dashboard/settings` + `/dashboard/profile` onto the real APIs; added GDPR export + account-deletion (verified: re-auth→sole-owner-guard chain) + settings-PUT validation; cut i18n to `en`; deleted the mock workspace switcher. 2FA→ADR-0026, switching→ADR-0027. |
| [0018](ADR-0018-ai-features-strategy.md) | AI Features: Honest Availability & Mounting | Proposed | 503 `AI_UNAVAILABLE` without a key (mock only in demo mode, flagged as simulated); unify all 13 routes on `aiService` with configurable model; per-workspace quotas; mount the orphaned AI/audience UIs. |
| [0019](ADR-0019-billing-and-subscriptions.md) | Billing & Subscriptions with Stripe | ✅ Implemented (2026-07-07) | Checkout/Portal/webhook/subscription routes + entitlements enforcement at accounts/posts/seats/AI; 14-day no-card PRO trial (proven live); `/dashboard/billing` rebuilt on live data (mock plans/invoices/4242 deleted). Live checkout flows await real Stripe keys. |
| [0020](ADR-0020-client-portal-and-report-sharing.md) | Client Portal & Shareable Reports | Proposed | Phased: tokenized snapshot report share links first (`ReportShareLink`, hashed tokens, optional password); then a real CLIENT_VIEWER portal with an explicit read-only allowlist. |

### Quality, operations, hygiene — not yet implemented
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0021](ADR-0021-testing-strategy-and-quality-gates.md) | Testing Strategy & Honest Quality Gates | ✅ Implemented (2026-07-07) | First-ever green suite: 12/12 suites, 158 tests; measured coverage ratchet replaces the 70% fantasy; auth-triple integration net + webhook idempotency tests; golden paths proven in a live browser (17/17 specs incl. axe a11y); CI Jest job flipped to BLOCKING. |
| [0022](ADR-0022-cicd-and-deployment.md) | CI/CD & Self-Hosted Docker Deployment | ✅ Implemented (2026-07-06) | Verified end-to-end locally: prod image **builds** (595 MB, was impossible), **boots healthy**, and migrates offline via a self-contained pinned prisma CLI. Honest 8-job ci.yml (blocking schema/build/docker-image — the `sonner`-class gate); SSH deploy w/ body-asserting health gate + auto-rollback; k8s/Vercel contradictions deleted. Live VM deploy awaits provisioning (runbook shipped). |
| [0023](ADR-0023-observability-and-monitoring.md) | Observability: Real Metrics, Logging & Health | Proposed | prom-client singleton at `/api/metrics`; repair the Prometheus/Grafana/Loki compose stack; real readiness checks; replace every Math.random metric endpoint with real sources or remove it. |
| [0024](ADR-0024-codebase-hygiene.md) | Codebase Hygiene & Dead Code Removal | ✅ Implemented (2026-07-06) | All verified-dead files/routes/pages deleted (re-verified at execution); missing live-surface deps fixed; **first-ever green `next build`** (241 pages — five deferred docs routes had parse errors, so no prior tree ever compiled); docs consolidated (README 2,722→125); knip baseline landed. |
| [0025](ADR-0025-seeding-and-demo-mode.md) | Seeding Strategy & Explicit Demo Mode | Proposed | One `DEMO_MODE` flag through one server-only helper with an enumerated registry of demo behaviors; tiered modular seeders (minimal/demo/test), prod-runnable minimal seed, generated credentials. |

### Follow-up ADRs filed from implementation
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0026](ADR-0026-two-factor-authentication.md) | Two-Factor Authentication (TOTP) | Proposed (stub) | Deferred from ADR-0017 B2: real TOTP with ADR-0006-encrypted secret storage, backup codes, enrollment QR, and a NextAuth challenge step — replacing the removed dead 2FA toggle. |
| [0027](ADR-0027-workspace-switching.md) | Workspace Switching (Session-Scoped Active Workspace) | Proposed (stub) | Deferred from ADR-0017 E4: introduce a session-scoped active workspace on ADR-0004's helpers + a real switch/create flow, restoring the capability the deleted mock page pretended to have. |

## Status legend

- **✅ Implemented** — code landed, tested (unit + static + live runtime proof), committed and pushed to `main`.
- **✅ Phases N–M implemented** — a bounded subset of the ADR's phases landed; remaining phases explicitly deferred to a named follow-up ADR.
- **Promoted on implementation** — ADR-0009 and ADR-0010 were drafted `Proposed` but were implemented, tested, and merged; on 2026-07-06 their status was promoted to `Accepted` to match reality (implementation-and-merge is the acceptance signal). Their in-file implementation notes record the promotion and any deferred sub-scope.
- **Accepted — not yet implemented** — the decision is final and binding; no code has shipped against it yet.
- **Proposed** — drafted and reviewed, not yet a binding decision, not implemented.

## Recommended implementation sequence

Steps 1–7 below are **done**. What's left starts at step 8.

1. ~~**Foundation** — ADR-0002, then ADR-0003.~~ ✅ Done.
2. ~~**Security core** — ADR-0006, ADR-0004, ADR-0005.~~ ✅ Done.
3. ~~**Make the product real** — ADR-0008 (worker/publishing), ADR-0007 (storage), ADR-0009 (Twitter/X + Meta foundations), ADR-0010 (notifications).~~ ✅ Done (ADR-0009's live-platform verification remains external-blocked).
4. ~~**Repairs** — ADR-0011 (support), ADR-0012 (admin).~~ ✅ Done.
5. ~~**Shrink the surface** — the flag-off mechanics of ADR-0013/0014/0015.~~ ✅ Done.
6. ~~**Settings** — ADR-0016 (admin settings + real backups), ADR-0017 (user settings/personalization).~~ ✅ Done.
7. ~~**Hygiene + honest pipeline** — ADR-0024 (dead-code sweep → first-ever green `next build`), then ADR-0022 (CI/CD + buildable prod image built on it).~~ ✅ Done.
8. ~~**Test ratchets** — ADR-0021.~~ ✅ Done (Jest gate now blocking; e2e flips after proving green in CI; lint/typecheck ratchets remain future raises).
9. **Growth** — ~~ADR-0019 (billing/Stripe)~~ ✅ Done; next: ADR-0018 (AI availability + UI mounting), ADR-0020 (client portal), ADR-0025 (seeding/demo mode).
10. **Observability (incremental throughout)** — ADR-0023: populate the `monitoring` compose profile ADR-0022 stubbed; owns the health/uptime scope ADR-0016 deferred.
11. **Follow-ups** — ADR-0026 (2FA), ADR-0027 (workspace switching), each filed from ADR-0017.

## Provenance

Drafted 2026-07-02 by a 41-agent workflow (24 architect drafters, each re-verifying audit claims against the code; 2 cross-document reviewers; 15 fix agents applying 22 accepted review findings). Drafters recorded 60+ corrections where the code differed from — usually worse than — the audit; the most significant are noted inside the affected ADRs.

Implementation of ADR-0002 through ADR-0012 ran 2026-07-03 through 2026-07-06, each via a dedicated multi-agent workflow with independent live-runtime verification (schema validation, encryption round-trips, a live SSE push proof, a live Meta webhook signature/ingestion proof, a live support-ticket reply→email→resolve proof, etc.) before commit.
