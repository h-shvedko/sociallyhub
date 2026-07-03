# SociallyHub — Architecture Decision Records

This folder is the canonical remediation and evolution plan for SociallyHub, produced from the verified code audit of 2026-07-02 (see the "Current State" section at the top of `CLAUDE.md`). Process rules are in [ADR-0001](ADR-0001-record-architecture-decisions.md).

**Owner decisions binding this set (2026-07-02):** deployment standardizes on self-hosted Docker (Vercel removed) · repair Support + Admin RBAC now, defer Community / Documentation / Discord behind feature flags · Stripe billing is in scope now.

## Index

### Foundation (prerequisites for everything)
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0002](ADR-0002-prisma-schema-remediation.md) | Prisma Schema Remediation & Migration-First Workflow | Accepted | Fix all 33 validation errors in place (keep analytics `UserSession`, delete the RBAC copy; define the 15 missing `Documentation*` enums), regenerate the client, baseline the DB, ban `db push`, gate CI on `prisma validate` + migration drift. |
| [0003](ADR-0003-auth-helpers-and-route-conventions.md) | Auth Helper Consolidation & API Route Conventions | Accepted | One canonical `@/lib/auth` module (`getAuthenticatedUser()`/`requireSession()`); codemod ~330 broken or unawaited call sites across 64 files; migrate 40 legacy dynamic routes to Next 15 async params; zod + single error envelope conventions enforced by ESLint. |

### Security
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0004](ADR-0004-platform-authorization-model.md) | Platform Authorization Model & RBAC Enforcement | ✅ Implemented (2026-07-03) | Two-tier model: new `User.isPlatformAdmin` gates `/api/admin/**` and global settings; `WorkspaceRole` enforced only via central helpers; drop the never-enforced Role/UserRole/Permission tables. |
| [0005](ADR-0005-api-security-hardening.md) | API Security Hardening | ✅ Implemented (2026-07-04) | Default-deny `withApiAuth` wrapper with CI enforcement (warn mode); endpoint-by-endpoint remediation table (ticket holes, global-config access, unauthenticated writes); remove blanket public Cache-Control on `/api/*`; Redis rate limiting; signed OAuth state. |
| [0006](ADR-0006-cryptography-and-secrets.md) | Cryptography, Token Encryption & Secrets | Accepted | Rewrite `encryption.ts` on AES-256-GCM/`createCipheriv` with versioned ciphertext and mandatory `ENCRYPTION_KEY`; encrypt SocialAccount tokens + IntegrationSetting credentials with migration; HMAC-sign OAuth state. |

### Core product pipeline
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0007](ADR-0007-media-storage-and-serving.md) | Media Storage, Uploads & Serving | Proposed | Single storage abstraction (private local-disk now, MinIO/S3 in prod), one upload endpoint, one authenticated serving route; ticket attachments go private; ClamAV scanning via the worker. |
| [0008](ADR-0008-background-jobs-and-publishing.md) | Background Jobs & the Publishing Pipeline | Accepted | Dedicated worker container (`src/worker.ts`, same image); enqueue from `/api/posts` with deterministic job IDs; DB-backed account/token resolution; fix processor success-handling; client-report schedules become repeatable jobs. |
| [0009](ADR-0009-social-platform-integrations.md) | Social Platform Integration Completion | Proposed | Depth-first: finish Twitter/X + Meta Graph (FB/IG) end-to-end (real PKCE, media, replies, refresh, webhooks+polling ingestion, honest analytics); flag LinkedIn/TikTok/YouTube unavailable; demo fabrication only in demo mode. |
| [0010](ADR-0010-realtime-and-notifications.md) | Realtime Transport & Notification Delivery | Proposed | SSE from a Next route backed by Redis pub/sub; persist-first pipeline on the real `Notification` model; in-app + email + web-push channels (SMS cut; fastify/socket.io-client removed). |

### Subsystem repairs and deferrals
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0011](ADR-0011-support-subsystem-remediation.md) | Support Subsystem Remediation | Accepted | Repair in place after 0002: enum/params fixes, rewrite support-agents on the canonical `SupportAgent` model, close auth holes, real emails, private attachments, seed data, definition-of-done checklist. |
| [0012](ADR-0012-admin-rbac-remediation.md) | Admin Dashboard & RBAC Remediation | Accepted | Rebuild the admin console as a platform-operator console on `isPlatformAdmin` + `WorkspaceRole`; migrate only AuditLog/UserActivity; cut the Role/Permission catalog; defer SSO behind a flag; fix fantasy fields per cluster. |
| [0013](ADR-0013-community-subsystem-deferral.md) | Community Subsystem: Defer | Accepted | `FEATURE_COMMUNITY` flag (default off) enforced by new root middleware 404ing `/api/community/**`; UI entry points removed; documented repair plan + un-defer criteria. |
| [0014](ADR-0014-documentation-management-deferral.md) | Documentation Management: Defer | Accepted | `FEATURE_DOCUMENTATION` flag (default off) over the whole docs layer; missing enums fixed in 0002 regardless; default un-defer path is merging docs into the Help Center. |
| [0015](ADR-0015-discord-integration-deferral.md) | Discord Integration: Defer | Accepted | `FEATURE_DISCORD` flag nested under Community's; delete the hardcoded demo server + mock leaf routes; keep the config CRUD; phased real plan starts with a notifications webhook slice. |

### Settings, AI, growth
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0016](ADR-0016-admin-settings-configuration.md) | System Settings: Real Operations over Simulations | Proposed | Keep and make real five categories (real pg_dump backups on the worker, feature flags as the standard system, email templates, integrations, system config); delete the fake audit/optimize/test action endpoints. |
| [0017](ADR-0017-user-settings-and-personalization.md) | User Settings, Personalization & i18n Scope | Proposed | Mount `SettingsProvider` (theme via next-themes); rewrite `/dashboard/settings` onto the real APIs; implement GDPR export + deletion now; defer 2FA; cut locale picker to `en` until translations exist. |
| [0018](ADR-0018-ai-features-strategy.md) | AI Features: Honest Availability & Mounting | Proposed | 503 `AI_UNAVAILABLE` without a key (mock only in demo mode, flagged as simulated); unify all 13 routes on `aiService` with configurable model; per-workspace quotas; mount the orphaned AI/audience UIs. |
| [0019](ADR-0019-billing-and-subscriptions.md) | Billing & Subscriptions with Stripe | Accepted | Stripe Checkout + Billing Portal; workspace-level subscriptions in new `Subscription`/`StripeEvent` models; code-defined Free/Pro/Business tiers enforced via one entitlements helper; 14-day no-card trial. |
| [0020](ADR-0020-client-portal-and-report-sharing.md) | Client Portal & Shareable Reports | Proposed | Phased: tokenized snapshot report share links first (`ReportShareLink`, hashed tokens, optional password); then a real CLIENT_VIEWER portal with an explicit read-only allowlist. |

### Quality, operations, hygiene
| ADR | Title | Status | Decision in one line |
|---|---|---|---|
| [0021](ADR-0021-testing-strategy-and-quality-gates.md) | Testing Strategy & Honest Quality Gates | Accepted | Fix Jest/Playwright config bugs; replace the unattainable 70% gate with a measured coverage ratchet; targeted pyramid (authz/crypto/entitlements units, per-route auth-triple integration net, five chromium golden paths). |
| [0022](ADR-0022-cicd-and-deployment.md) | CI/CD & Self-Hosted Docker Deployment | Accepted | Single-VM compose topology (nginx+certbot, app, worker, migrate job); build-once GHCR image, SSH deploy, sha tags + one-command rollback; delete Vercel workflow and unmaintained k8s manifests; honest CI stages incl. typecheck + schema gates. |
| [0023](ADR-0023-observability-and-monitoring.md) | Observability: Real Metrics, Logging & Health | Proposed | prom-client singleton at `/api/metrics`; repair the Prometheus/Grafana/Loki compose stack; real readiness checks; replace every Math.random metric endpoint with real sources or remove it. |
| [0024](ADR-0024-codebase-hygiene.md) | Codebase Hygiene & Dead Code Removal | Accepted | Delete (not quarantine) all verified-dead files/routes/deps/models in blast-radius order with zero-import re-verification; docs consolidated (CLAUDE.md Current State + ADRs canonical); knip gate in CI. |
| [0025](ADR-0025-seeding-and-demo-mode.md) | Seeding Strategy & Explicit Demo Mode | Proposed | One `DEMO_MODE` flag through one server-only helper with an enumerated registry of demo behaviors; tiered modular seeders (minimal/demo/test), prod-runnable minimal seed, generated credentials. |

## Recommended implementation sequence

Dependencies say 0002 → 0003 gate nearly everything. The pragmatic order:

1. **Foundation** — ADR-0002, then ADR-0003. Nothing else is safe to build first.
2. **Shrink the surface (cheap, parallel)** — the flag-off parts of ADR-0013/0014/0015 and the deletion phases of ADR-0024. Less code to secure, test, and repair.
3. **Security core** — ADR-0006, ADR-0004, ADR-0005 (in that order: crypto primitives → authz model → endpoint enforcement).
4. **Honest pipeline & gates** — ADR-0022 and ADR-0021 early, so CI protects all subsequent work.
5. **Make the product real** — ADR-0008 (worker/publishing), ADR-0007 (storage), ADR-0009 (Twitter/X + Meta end-to-end), ADR-0010 (notifications).
6. **Repairs & settings** — ADR-0011 (support), ADR-0012 (admin), ADR-0016, ADR-0017, ADR-0025.
7. **Growth** — ADR-0019 (billing; can start any time after step 1 in parallel), ADR-0018 (AI), ADR-0020 (client portal), ADR-0023 (observability, incremental throughout).

## Provenance

Drafted 2026-07-02 by a 41-agent workflow (24 architect drafters, each re-verifying audit claims against the code; 2 cross-document reviewers; 15 fix agents applying 22 accepted review findings). Drafters recorded 60+ corrections where the code differed from — usually worse than — the audit; the most significant are noted inside the affected ADRs.
