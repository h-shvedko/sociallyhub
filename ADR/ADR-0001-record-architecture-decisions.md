# ADR-0001: Record Architecture Decisions

- **Date:** 2026-07-02
- **Status:** Accepted
- **Deciders:** Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub has grown to ~216k lines of TypeScript, 146 Prisma models, and 299 API route files across two distinct eras of development. A verified code audit (2026-07-02, recorded in the "Current State" section of `CLAUDE.md`) found that architectural decisions were made implicitly and inconsistently: entire subsystems were committed against a database schema that never validated, three different auth-helper import paths coexist (two of them nonexistent), two deployment stories contradict each other (Vercel vs self-hosted), and documentation recorded intent as if it were fact. There is no place where a future contributor (human or AI) can learn *why* the system is shaped the way it is, what was decided, and what was deliberately deferred.

## Decision

We will record all significant architecture decisions as Architecture Decision Records (ADRs) in the `ADR/` directory at the repository root.

- **Format:** MADR-flavored markdown, one decision per file, with sections: Date, Status, Deciders, Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Implementation Plan, Risks and Mitigations, Related ADRs.
- **Naming:** `ADR-NNNN-short-kebab-slug.md`, numbered sequentially, never renumbered.
- **Status lifecycle:** `Proposed` → `Accepted` → (`Deprecated` | `Superseded by ADR-XXXX`). Deferred work is captured as an *Accepted* decision to defer, with explicit un-defer criteria.
- **Index:** `ADR/README.md` lists every ADR with its status and one-line decision, grouped by theme, plus the recommended implementation sequence.
- **Discipline:** a change that alters a recorded decision requires a new ADR that supersedes the old one; the old ADR is edited only to update its status line. Claims about current system behavior made in an ADR must be verified against the code at time of writing, not copied from other documentation.

## Consequences

- **Positive:** decisions and their rationale survive context loss between sessions and contributors; the repair of the currently broken subsystems follows an explicit, reviewable plan; the "docs describe intent as fact" failure mode is countered by the verification rule.
- **Negative:** small maintenance overhead per significant change; the index must be kept current.

## Related ADRs

All subsequent ADRs (ADR-0002 through ADR-0025) are created under this process. See `ADR/README.md` for the full index.
