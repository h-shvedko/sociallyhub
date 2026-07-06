# TODO_HELP_DASHBOARD.md — Historical Pointer

> **This document is retired as a working roadmap** (ADR-0024 Track D, 2026-07-06).
> It previously mixed a stale planning checklist with later implementation summaries that
> contradicted it (including a stale "December 2024" date). The contradictory content has been
> removed; this file is retained only as a pointer. Git history holds the full original.

## What was actually built (the implementation summaries were the authoritative part)

The following Help/Support/Admin subsystems are **built and verified in code** — see
`CLAUDE.md` ("Current State" → subsystem table) and the owning ADRs:

- **Help Center (public)** — articles, FAQs, search (ILIKE + JS scoring), bookmarks, votes,
  video tutorials. `src/app/dashboard/help` + `/api/help/**`.
- **Help Articles CMS (admin)** — revisions, approval workflow, bulk ops, import/export.
  `/api/admin/help/**` (auth repaired by ADR-0003/0005).
- **FAQ Management** — full CRUD with categories and admin authentication.
- **Support Ticket Console** — tickets/chat/agents with real email delivery, private
  attachments, honest analytics, seed data. Repaired and verified end-to-end by **ADR-0011**
  (create → assign → reply → email → resolve).

## Where the open items went

All still-open items from this file moved to the single roadmap, **`TODO.md`**:

- Phase 3 admin analytics / monitoring / backup-UI / integrations beyond ADR-0016 scope
- Mobile & accessibility improvements
- Performance & SEO for public help content

## Sources of truth

- `CLAUDE.md` — verified current state
- `TODO.md` — the one open-work list
- `ADR/README.md` — decisions and sequencing (esp. ADR-0011 Support, ADR-0016 Admin Settings)
- `STRUCTURE.md` — codebase map
