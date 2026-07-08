# TODO — SociallyHub Roadmap

> **The single open-work list for this repo.** Status ground truth lives in
> `CLAUDE.md` ("Current State" section); decisions and sequencing live in `ADR/README.md`.
> Codebase map: `STRUCTURE.md`. API conventions: `docs/api-conventions.md`.
> Last reconciled against code: **2026-07-06** (ADR-0024 Track D).

---

## ✅ Done (verified in code)

| Item | Evidence / owning ADR |
|---|---|
| Prisma schema valid + migration-first workflow | ADR-0002 (`npm run db:check`, CI gate) |
| Auth consolidation (`@/lib/auth` barrel, awaited helpers) | ADR-0003 |
| Admin RBAC repaired (`isPlatformAdmin`, no cross-tenant escalation) | ADR-0004, ADR-0012 |
| API security hardening (`withApiAuth`, middleware, no-store) | ADR-0005 |
| Real encryption at rest (AES-256-GCM `enc:v1`) + signed OAuth state | ADR-0006 |
| Private storage service + authenticated `GET /api/files/[...key]` | ADR-0007 |
| Publishing pipeline (BullMQ worker, honest per-variant outcomes) | ADR-0008 |
| Integration foundations (reply/refresh, Meta webhook, no fabricated analytics) | ADR-0009 |
| Notifications + realtime (Notification model, SSE over Redis, web-push) | ADR-0010 |
| Support system (tickets/chat/agents, real emails, seed data) | ADR-0011 — `/api/support/**`, `/dashboard/admin/support/**` |
| Admin settings + real `pg_dump` backups | ADR-0016 |
| User settings UI wired + GDPR export/delete | ADR-0017 |
| **Help Center** (articles, FAQs, search, bookmarks, votes) | Built — `src/app/dashboard/help` + `/api/help/**` |
| **Custom Dashboards** (widget library, drag-drop, persisted layouts) | Built — `CustomDashboard` model, @dnd-kit builder |
| Comprehensive seed data (~30k rows, `prisma/seed.ts`) | Built (demo/seeding *strategy* refinement is ADR-0025) |

## ⏸️ Deferred behind feature flags (do not build on these until un-deferred)

- **Community forum / moderation / feature requests** — `FEATURE_COMMUNITY`, ADR-0013 (404 by default)
- **Documentation Management** — `FEATURE_DOCS_MANAGEMENT`, ADR-0014 (default un-defer path: merge into Help Center)
- **Discord integration** — `FEATURE_DISCORD`, ADR-0015 (fabricated data deleted; real integration deferred)
- **SSO login flow** — flag-gated page; deferred (ADR-0012 note)

---

## 🔴 Open work (decided, not built)

Each item is owned by an ADR — read the ADR before starting.

### Billing System — **ADR-0019**
- Stripe integration (subscriptions, invoices, payment methods, webhooks)
- Replace the static `/dashboard/billing` mock (hardcoded plans, fake VISA •••• 4242)

### AI feature mounting — **ADR-0018**
- ✅ ~~Mount the orphaned `src/components/audience/*` UI~~ — `/dashboard/audience` mounted (ADR-0018 Track D, 2026-07-07): Segments / Posting Times / Sentiment tabs, availability-gated via `GET /api/ai/status` (honest full-page state when no provider; "Simulated (demo)" badge in demo mode). `AudienceIntelligenceDashboard` deliberately NOT mounted — its Overview is 100% hardcoded fabricated data and its other tabs duplicate the mounted dashboards; delete or rewrite honestly.
- ✅ ~~Mount `src/components/ai/visual/visual-analytics-dashboard`~~ — "Visual Insights" tab added to the Analytics dashboard (same availability gating). `image-analyzer`/`image-optimizer` were already mounted via the post composer's Visual AI section.
- ✅ ~~Integrate AI hashtag suggestions + content generation into the post composer~~ — was already built (`AIContentGenerator`, `HashtagSuggestions`, `ToneAnalyzer`, `PerformancePredictor` render from the AI Assistant / AI Analysis toggles); Track D added availability gating (toggles disabled with "AI unavailable — configure OPENAI_API_KEY" when provider is `none`; "Simulated (demo)" badges when `mock`).
- Apply `AI_MOCK_DATA.md` Priority-1 fix (`/api/ai/performance/predict`, `/api/ai/tone/analyze` bypass the mock-fallback layer)

### Client Portal — **ADR-0020**
- ✅ ~~Read-only client role/dashboard; shareable report links (optional password)~~ — implemented 2026-07-07 (Phases 0–2): `ReportShareLink` tokenized snapshot links (sha256-at-rest, optional bcrypt password, expiry/revocation, uniform 404) + `/portal` for scoped `CLIENT_VIEWER` members (JWT `portalOnly` edge default-deny; PRO+ invite gating). Phase 3 (post approvals) is a separate go/no-go; real server-generated PDFs remain on the ADR-0008/0007 upgrade path.

### Testing — **ADR-0021**
- Fix `jest.config.js` (`moduleNameMapping` → `moduleNameMapper`), attainable coverage gate
- Playwright E2E with a real web server in CI

### CI/CD & deployment — **ADR-0022**
- One deployment story (self-hosted Docker); fix `deploy.yml` (`workflow_call`, nonexistent scripts), `upload-artifact@v3`
- Missing prod compose mounts (nginx/grafana configs); nginx SSE tuning; S3/MinIO storage driver

### Observability — **ADR-0023**
- ✅ ~~Real monitoring/alerting (replace `Math.random` simulations)~~ — implemented 2026-07-07: prom-client singleton at `/api/metrics` (real accumulating counters + DB gauges, bearer-protected); honest `/api/health` readiness; every fabricated metric (`'99.9%'`, monitoring-dashboard hardcoded bars, platform/clients/campaigns `Math.random`) removed with a **blocking CI grep guard**; Prometheus/Grafana/Loki config `promtool`-validated; worker `:9464`; Sentry/GlitchTip dormant without a DSN. Deferred: real exporters as compose services, OTel tracing, turning Sentry on.

### Seeding & demo mode — **ADR-0025**
- ✅ ~~Demo-token gating; seed strategy for newer subsystems; retire `prisma/seed.js`~~ — implemented 2026-07-08: single `DEMO_MODE` flag (NODE_ENV heuristic + ENABLE_DEMO backdoor removed) + `docs/demo-mode.md` registry; tiered dispatcher (minimal/demo/test), prod-safe minimal bootstrap (settings + platform-admin), esbuild-bundled prod-image seeding (fail-loud entrypoint); committed passwords purged + blocking CI guard; `seed.js` already gone (ADR-0024). Deferred: login-time forced-password-change enforcement; atomizing the demo generator into per-domain files.

### Two-Factor Authentication — **ADR-0026** (stub)
### Workspace switching — **ADR-0027** (stub)

### Help/Admin dashboard remainder (absorbed from TODO_HELP_DASHBOARD.md)
- Phase 3 admin analytics/monitoring/backup-UI/integrations **beyond ADR-0016 scope** (advanced help-content analytics, monitoring dashboards, integration marketplace)
- Mobile & accessibility pass over Help Center + admin (keyboard nav, ARIA, responsive audit)
- Performance & SEO for public help content (caching, meta/OG, sitemap)

### Product polish (no ADR yet — small, self-contained)
- Dashboard widgets: To-Do List (approval-workflow + inbox), Actionable Insights, unified activity feed
- Post composer: accurate per-platform `PostPreview` rendering
- Inbox: automated-response modal CSS, live typing indicator, reply attachments
- Charts UX audit: responsive scaling, accessible palettes, rich tooltips
- Social account connection overhaul: clear platform list, reconnect alerts for expired tokens (real OAuth credentials gated on paid X tier / Meta App Review — see ADR-0009)

---

## How to add work here

New significant work gets an ADR first (`ADR/README.md` for the template/index), then a one-line
entry above cross-referencing it. Keep implementation detail in the ADR, not here.
