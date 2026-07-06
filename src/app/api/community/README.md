# Community subsystem — DEFERRED (do not extend or "fix" casually)

> **Status: deferred behind a feature flag per [ADR-0013](../../../../ADR/ADR-0013-community-subsystem-deferral.md) (Accepted).**
> The Discord routes nested under `discord/**` are additionally covered by
> [ADR-0015](../../../../ADR/ADR-0015-discord-integration-deferral.md).

## What this directory is

The **36 route files** under `src/app/api/community/**` (forum, feature
requests, Discord, moderation rules/logs/audit, spam detection, content
filtering, reports, user moderation, activity feed, analytics/health/insights)
make up the Community subsystem. It is backed by ~15 Prisma models
(`CommunityForumPost`, `CommunityForumReply`, `FeatureRequest`,
`DiscordIntegration`, `ModerationAction`, `SpamDetection`, `AutoModerationRule`,
`CommunityAnalytics`, …).

## Why it is gated off

The subsystem is **KNOWN-BROKEN**. It is not runnable today and much of it stays
broken even after the Prisma client regenerates. Verified defects (see ADR-0013
for the full inventory):

- **Schema-mismatched writes** — `spam-detection/route.ts` and
  `content-filtering/route.ts` write `SpamDetection` fields that do not exist on
  the model, and pass `workspaceId: null` where the column is required.
- **Invalid enum usage** — ~20 `communityActivity.create()` call sites write
  `activityType` values absent from the `CommunityActivityType` enum
  (`MODERATION_ACTION`, `REPORT_SUBMITTED`, `DISCORD_*`, `FEATURE_REQUEST_*`),
  and several routes filter enums with `startsWith`, which Prisma rejects.
- **Nonexistent model references** — `analytics/`, `insights/`, and `health/`
  call `prisma.communityForumComment`; the model is `CommunityForumReply`.
- **Missing API surface** — there are no endpoints for forum replies, forum
  votes, single-post view, or feature-request comments; no management API for
  `ModerationQueue` / `CommunityAnalytics`.
- **Mock internals** — analytics/health/insights mix real aggregation with
  `Math.random()` scores and hardcoded values.

## How the gate works

`FEATURE_COMMUNITY` in `src/lib/config/features.ts` defaults to `false`. With the
flag off, `/api/community/**` and `/community/**` are gated at the edge by
`src/middleware.ts`, so these routes return 404 regardless of their internals.
The flag must **remain `false` in production** until the repair phase ships.

## Rules for contributors

- **Do NOT extend, wire up, or casually "fix" any route in this tree.** These
  pre-existing defects are tracked as deferred, not bugs to patch ad hoc.
- **Do NOT flip `FEATURE_COMMUNITY=true` in production.** It re-exposes broken,
  insecure endpoints.
- Any repair happens **only on un-defer**, as one deliberate effort — see
  **ADR-0013 Phase 3** (repair backlog: schema-mismatch writes, enum
  reconciliation, `communityForumComment` → `communityForumReply`, the missing
  reply/vote/comment endpoints, the missing public + admin UI, and replacing the
  mock metrics) and the **un-defer criteria** in ADR-0013's Decision Outcome.
