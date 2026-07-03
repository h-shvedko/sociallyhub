# ADR-0007: Media Storage, Uploads, and Serving Architecture

- Date: 2026-07-02
- Status: Accepted — **Phases 0–2 implemented 2026-07-04** (S3/ClamAV/images-repurpose deferred)
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-04).** Delivered (Phases 0–2): storage service
> `src/lib/storage/` (driver interface + local driver rooted at `STORAGE_LOCAL_ROOT`, two-layer
> traversal guard, `getStorage()` with an `s3` seam that throws "wired in ADR-0022"); `/api/media/upload`
> rebuilt on the service with real sharp dimensions + `Asset.storageKey` + `url=/api/files/{key}`;
> unified authenticated `GET /api/files/[...key]` (fail-closed: workspace membership for `media/*`,
> session+workspace for `tickets/*`, public for `help/*`; nosniff + attachment disposition); migration
> `0007` (additive `storageKey` on Asset + TicketAttachment); `scripts/migrate-uploads.ts` (dry-run/
> idempotent). Ticket attachments made private with MIME-derived extensions (killed the
> `split('.').pop()` traversal) and `scanResult = null` (no more fake `'pending'`). Deleted the
> orphaned `/api/upload` and dead `/api/uploads/[...path]`. `/api/images` interim SSRF stop
> (session-gated, rejects non-relative URLs, no wildcard CORS). `sharp` moved to `dependencies`.
> **Verified:** upload→serve round-trip (member 200 / anon 401 / non-member 404, bytes match, real
> dims + storageKey); DELETE → file 404; old routes 404; SSRF 401/400; traversal suite 35/35;
> `prisma validate`/`db:check` green. **Deferred (co-scoped):** S3/MinIO driver + CI-against-MinIO
> (ADR-0022), ClamAV `scan-attachment` worker (ADR-0008), full `/api/images` key-input repurpose +
> `CDNManager`/`image-optimization` deletion (ADR-0024). **Note:** the ADR-0005 middleware sets
> `Cache-Control: no-store` on all `/api/*`, which overrides `/api/files`'s intended
> `private/public max-age` — stricter for private media; help/* public caching would need a
> middleware carve-out (follow-up).

## Context and Problem Statement

SociallyHub stores every uploaded file on the local filesystem, split across two
incompatible layouts with three different (and partly imaginary) access-control
stories. The verified state of the code:

1. **`POST /api/media/upload`** (`src/app/api/media/upload/route.ts`) is the
   upload path every UI component actually uses (`post-composer.tsx`,
   `assets-manager.tsx`, `image-analyzer.tsx`, `image-optimizer.tsx`). It writes
   to `public/uploads/media/{uuid}{ext}` and stores
   `Asset.url = "/uploads/media/{file}"`. Because the file lives under
   `public/`, Next.js serves it **statically to anyone who knows or guesses the
   URL — no session, no workspace check**. It also writes placeholder
   dimensions (`width = 1920, height = 1080, duration = 60.0`) into `Asset`
   instead of reading real ones.

2. **`POST /api/upload`** (`src/app/api/upload/route.ts:62`) writes to a
   *non-public* `{cwd}/uploads/{workspaceId}/` directory and stores
   `Asset.url = "/uploads/{workspaceId}/{file}"`. That URL 404s in the browser
   (the file is outside `public/` and no rewrite maps `/uploads/*` to the API).
   The endpoint has **zero frontend callers** — it is orphaned dead code. It
   also picks the target workspace via `findFirst` on the user's memberships
   instead of an explicit `workspaceId`, so multi-workspace users could upload
   into the wrong workspace.

3. **`GET /api/uploads/[...path]`** (`src/app/api/uploads/[...path]/route.ts`)
   is the only *authenticated* serving route: session check, `UserWorkspace`
   membership on the first path segment, and an `Asset` row lookup before
   streaming from `{cwd}/uploads/`. But since every real `Asset.url` points at
   the static `/uploads/media/...` path and nothing generates `/api/uploads/...`
   URLs, **this route protects nothing in practice**. It also sets
   `Cache-Control: public, max-age=86400` on authenticated responses — a
   shared-cache leak if a CDN or nginx cache is ever put in front (compounded
   by `next.config.js`'s blanket `public, s-maxage=60` on all `/api/*`, see
   ADR-0005).

4. **Support ticket attachments**
   (`src/app/api/support/tickets/[ticketId]/attachments/route.ts`) accept
   PDFs, Word documents, ZIPs, and images up to 10MB and write them to
   `public/uploads/tickets/{uuid}.{ext}` with
   `fileUrl = "/uploads/tickets/{file}"` — **world-readable support
   correspondence**. The route hardcodes `isScanned: false,
   scanResult: 'pending'` on every `TicketAttachment` row; the `scanResult`
   comment in `prisma/schema.prisma` (~line 3816) promises
   `"clean" | "suspicious" | "malware"`, but **no scanner exists anywhere in
   the repo** (no ClamAV, no scan job, nothing ever updates these fields), so
   `'pending'` is a permanent lie. The extension is taken from
   `file.name.split('.').pop()` unsanitized (a crafted filename like
   `x./../../evil` yields an extension containing path separators — a write
   outside the upload dir). Guest access (`session` absent) degrades the
   ownership check to `where = { id: ticketId }`: anyone with a ticket ID can
   list, upload, and delete attachments (access rules are ADR-0011's scope;
   the storage consequences are ours).

5. **Admin help-content uploads** (`src/app/api/admin/help/videos/upload`,
   `.../videos/thumbnails`, `.../articles/[id]/media`) also write into
   `public/uploads/videos/*` and `public/uploads/help-articles/` — acceptable
   visibility (help content is public-facing) but the same durability problem
   as below.

6. **Durability is broken in production.** `docker-compose.prod.yml` and
   `k8s/app-deployment.yaml` mount a volume **only at `/app/uploads`** (the
   directory used by the orphaned endpoint). Nothing mounts
   `public/uploads`, and `.gitignore` excludes `/public/uploads` — so every
   real upload (media, ticket attachments, help videos) lands in the
   container's writable layer and **is lost on redeploy**; with the k8s
   manifest's 3 replicas, uploads land on one pod and 404 on the others.
   `next.config.js` sets `output: 'standalone'`, so `public/` is baked at
   image build time (`Dockerfile.prod:58`).

7. **`GET /api/images`** (`src/app/api/images/route.ts` →
   `src/lib/cdn/cdn-manager.ts:createImageProcessor`) is a sharp-based
   transform proxy that `fetch()`es **any URL passed in the `url` query
   parameter with no authentication and no origin allowlist**, plus
   `Access-Control-Allow-Origin: *` — an open SSRF proxy and free transform
   service. Its only in-repo consumers are `cdn-manager.generateUrl()` and the
   dead `src/lib/image-optimization.ts`; no page uses either. The transform
   capability itself is worth keeping; its current exposure is not.

8. **Deletion is half-wired**: `DELETE /api/media`
   (`src/app/api/media/route.ts:158`) unlinks
   `join(cwd, 'public', asset.url)`, which works for `public/uploads/media`
   files but silently orphans anything under the non-public `uploads/` tree.

Per the owner's 2026-07-02 decisions, deployment standardizes on self-hosted
Docker (ADR-0022) and the support subsystem is being repaired now (ADR-0011),
so ticket attachments cannot stay world-readable and storage must survive
container replacement.

## Decision Drivers

- **Confidentiality**: workspace media and support attachments must be
  reachable only by authorized users; today authorization is bypassed by
  design (static serving).
- **Durability**: uploads must survive redeploys and (later) multiple app
  replicas — a hard requirement of the self-hosted Docker decision (ADR-0022).
- **One code path**: two upload endpoints, three directory layouts, and
  divergent delete logic guarantee drift; new features (chat attachments per
  ADR-0011, client-portal report files per ADR-0020) need one service to call.
- **Honesty**: `isScanned`/`scanResult` must either be real or not exist
  (project-wide "no simulated capabilities" principle, cf. ADR-0016,
  ADR-0021).
- **Security hardening**: SSRF in `/api/images`, path traversal in ticket
  filenames, and public cache headers on private responses align with
  ADR-0005's mandate.
- **Low migration risk**: existing `Asset.url` strings are embedded in DB rows
  and rendered by many components; the cutover must be scriptable.

## Considered Options

### Option A — Patch in place (move ticket dir, add rewrites)

Move `public/uploads/tickets` under the private `uploads/` tree, add a Next.js
rewrite from `/uploads/:path*` to `/api/uploads/:path*`, and mount
`public/uploads` as a second volume.

- Good: smallest diff; no new abstractions.
- Bad: keeps two upload endpoints and three layouts; the rewrite would route
  *all* media through a handler whose lookup contract
  (`[workspaceId, filename]`) doesn't match `/uploads/media/*` keys, so it
  needs rewriting anyway; still filesystem-only, so multi-replica remains
  broken; scan fields stay fake.

### Option B — Storage service abstraction: local-disk driver now, S3-compatible driver next (chosen)

Introduce `src/lib/storage/` with a small driver interface
(`put`, `getStream`, `delete`, `stat`) and two drivers: **local disk rooted at
a non-public data directory** (the already-mounted `/app/uploads` volume) and
**S3-compatible** (MinIO self-hosted, or any S3 endpoint) selected by
`STORAGE_DRIVER` env. All files — media, ticket attachments, help content —
are written through this service under one key scheme; all private files are
served by a single authenticated route; public help assets are served by the
same route on a no-auth branch keyed off record type. Unify uploads on
`/api/media/upload` (the endpoint the UI already uses) and delete
`/api/upload`.

- Good: one code path; access control enforced at the only exit; local driver
  keeps dev/CI dependency-free; S3 driver is a config flip that fixes
  multi-replica; ticket/chat/report features get a ready service.
- Bad: a data-and-file migration is required (rewrite `Asset.url` /
  `TicketAttachment.fileUrl`, move files); serving files through a Node route
  is slower than static serving (acceptable at current scale; nginx/MinIO
  offload is the escape hatch).

### Option C — Go straight to S3/MinIO only

Skip the local driver; make MinIO a hard dependency of every environment.

- Good: one driver, presigned URLs from day one.
- Bad: adds a service to dev, CI, and Playwright setups immediately;
  couples the urgent security fix (private ticket files) to an infrastructure
  rollout; contradicts the phased self-hosted approach in ADR-0022.

### Option D — Managed object storage + CDN with signed URLs

Cloudflare R2 / AWS S3 with direct-to-storage presigned uploads and CDN-signed
GET URLs.

- Good: best performance and scalability; app never proxies bytes.
- Bad: contradicts the binding self-hosted Docker decision; external account
  dependency; signed-URL leakage semantics are weaker than per-request
  session checks for support attachments. Revisit only if serving throughput
  becomes a measured problem (ADR-0023 will tell us).

## Decision Outcome

**Option B.** One storage service, two drivers, one authenticated serving
route. Concretely:

1. **Storage service** at `src/lib/storage/` with interface
   `StorageDriver { put(key, data, opts): Promise<void>; getStream(key): Promise<ReadableStream>; delete(key): Promise<void>; stat(key): Promise<{size, mtime} | null> }`
   and key scheme:
   - `media/{workspaceId}/{uuid}{ext}` — workspace media (private)
   - `tickets/{ticketId}/{uuid}{ext}` — support attachments (private, access
     rules per ADR-0011)
   - `help/{videos|thumbnails|articles}/{...}` — help content (public)
   Drivers: `local.ts` rooted at `STORAGE_LOCAL_ROOT` (default
   `{cwd}/uploads`, i.e. the volume prod already mounts) with key
   normalization that rejects `..` and absolute segments; `s3.ts` using
   `@aws-sdk/client-s3` against `S3_ENDPOINT`/`S3_BUCKET` (MinIO-compatible).
   `STORAGE_DRIVER=local` is the default; production flips to `s3` once the
   MinIO service lands in `docker-compose.prod.yml`.

2. **Single upload endpoint.** `/api/media/upload` remains the media API
   (every consumer already calls it) but is rebuilt on the storage service:
   explicit `workspaceId` + role check (as today), sharp-derived real
   dimensions replacing the 1920×1080 placeholders, and a new
   `Asset.storageKey` column (migration per ADR-0002). `src/app/api/upload/
   route.ts` is **deleted** (verified zero callers). Ticket and help-content
   routes call the same service instead of `fs` directly.

3. **Single serving route.** `GET /api/files/[...key]` replaces
   `/api/uploads/[...path]`: it resolves the owning record from the key prefix
   (`Asset` via `storageKey`, `TicketAttachment` via `storageKey`,
   help models for `help/*`), enforces access (workspace membership for media;
   ticket-scoped rules delegated to the ADR-0011 helper; none for `help/*`),
   and streams through the driver with `Cache-Control: private, max-age=3600`
   for private files (`public, max-age=86400` only for `help/*`),
   `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment`
   for any non-image/non-video MIME type. DB `url` fields store
   `/api/files/{key}` so browsers hit the route naturally — no rewrites.

4. **Ticket attachments go private** and the filename extension is derived
   from the validated MIME type (as `/api/media/upload` already does with its
   `ALLOWED_TYPES` map), eliminating the `split('.').pop()` traversal.

5. **Honest scanning.** Keep `TicketAttachment.isScanned`/`scanResult` but
   make them real: a ClamAV container (`clamav/clamav`) is added to the
   compose stacks and a `scan-attachment` BullMQ job (worker per ADR-0008)
   scans on upload and updates the fields; `/api/files` refuses
   `scanResult = 'malware'` (404) and serves not-yet-scanned documents only
   with `Content-Disposition: attachment`. Until the worker phase ships, the
   upload route stops writing the fake `'pending'` and leaves
   `scanResult = null`; **no UI may display a "scanned" state it cannot
   prove**. If the ClamAV phase is descoped, the follow-up is a migration
   dropping both fields — not leaving them fake.

6. **`/api/images` is repurposed, not deleted.** The sharp transform pipeline
   in `cdn-manager.ts` is kept, but the route accepts **only an internal
   storage key or asset ID** (`/api/images?key=media/...&w=640`), runs the
   same access check as `/api/files`, reads via the storage driver (no
   outbound `fetch` — the SSRF vector is removed), caches derived outputs
   under `derived/{key}/{transform-hash}`, and drops the `*` CORS handler.
   The speculative CDN-provider config (`CDNManager` Cloudflare/AWS purge
   code, unused `imageUtils`, dead `src/lib/image-optimization.ts`) is removed
   per ADR-0024.

## Consequences

### Positive

- Workspace media and support attachments are no longer world-readable; there
  is exactly one enforcement point for file access.
- Uploads survive redeploys today (existing `uploads` volume) and scale to
  multiple replicas with a one-line driver switch to MinIO/S3.
- One upload path and one delete path end the orphaned-file drift
  (`/api/media` DELETE goes through `storage.delete(storageKey)` and works for
  every file, not just `public/uploads` ones).
- `isScanned`/`scanResult` become real capabilities or disappear — no
  permanent `'pending'`.
- SSRF proxy, filename traversal, and public-cache-on-private-response issues
  are closed (supports ADR-0005).
- ADR-0011 (chat/ticket attachments) and ADR-0020 (shareable report files)
  get a ready-made service instead of inventing a third layout.

### Negative

- All private bytes flow through Next.js route handlers: more memory/CPU per
  download than static serving. Mitigations: streaming (no full-buffer
  `arrayBuffer()` reads), sharp-derived thumbnails, and — if ADR-0023 metrics
  show pressure — nginx `X-Accel-Redirect` or MinIO presigned GETs.
- A one-time migration must move files and rewrite `Asset.url` /
  `TicketAttachment.fileUrl`; any external references to old
  `/uploads/media/...` URLs (e.g., copied into post content) break unless the
  migration also rewrites them.
- New moving parts in prod compose (MinIO, ClamAV) to operate and back up.
- `next/image` cannot fetch session-protected sources server-side; components
  must use the `/api/images` transform route (or plain `<img>`) for private
  media instead of the Next image optimizer.

## Implementation Plan

**Phase 0 — Immediate containment (this week)**
1. (S) Delete orphaned `src/app/api/upload/route.ts`; add the removal to
   ADR-0024's dead-code list.
2. (S) `src/app/api/support/tickets/[ticketId]/attachments/route.ts`: stop
   writing `scanResult: 'pending'`; derive the stored extension from the
   MIME-type map, not `file.name`.
3. (S) `src/app/api/images/route.ts`: require a session and reject non-relative
   `url` values (interim SSRF stop until Phase 4); remove the `*` CORS
   handler.
4. (S) Change `Cache-Control` in `src/app/api/uploads/[...path]/route.ts` to
   `private, max-age=3600` (route dies in Phase 2 but headers leak now).

**Phase 1 — Storage service (week 1-2)**
5. (M) Create `src/lib/storage/{index,local}.ts`: driver interface, local
   driver rooted at `STORAGE_LOCAL_ROOT` (default `{cwd}/uploads`), key
   validation, streaming put/get. Unit tests for traversal rejection
   (ADR-0021).
6. (S) Migration (ADR-0002 workflow): add `Asset.storageKey String?` and
   `TicketAttachment.storageKey String?`.
7. (M) Rebuild `/api/media/upload` on the service: key
   `media/{workspaceId}/{uuid}{ext}`, real dimensions via sharp,
   `url = /api/files/{key}`. Point ticket attachments at
   `tickets/{ticketId}/...` and help-content routes at `help/...` keys.

**Phase 2 — Unified serving + data migration (week 2-3)**
8. (M) Implement `GET /api/files/[...key]` (auth helpers per ADR-0003, access
   rules per ADR-0004/ADR-0011); delete `/api/uploads/[...path]`.
9. (M) Migration script `scripts/migrate-uploads.ts`: move files from
   `public/uploads/{media,tickets}` and `{cwd}/uploads/{workspaceId}` into the
   new key layout under `STORAGE_LOCAL_ROOT`; backfill `storageKey`; rewrite
   `Asset.url`, `Asset.thumbnailUrl`, `TicketAttachment.fileUrl`. Idempotent,
   dry-run flag.
10. (S) Rewire `DELETE /api/media` to `storage.delete()`; add
    `public/uploads` cleanup note to ADR-0022's deploy runbook (dir should end
    up empty and stay gitignored).

**Phase 3 — S3 driver + MinIO (week 3-4, with ADR-0022)**
11. (M) `src/lib/storage/s3.ts` (`@aws-sdk/client-s3`), env:
    `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`,
    `S3_SECRET_KEY`. MinIO service + bucket bootstrap in
    `docker-compose.prod.yml`; driver integration test in CI against MinIO
    (ADR-0021).
12. (S) Document local→S3 rclone/`mc mirror` migration in the ADR-0022
    runbook.

**Phase 4 — Scanning and transforms (week 4-5)**
13. (M) ClamAV container + `scan-attachment` processor in the ADR-0008 worker;
    update `isScanned`/`scanResult`; `/api/files` blocks `malware`.
14. (M) Repurpose `/api/images` to key/asset-ID input with access checks and a
    `derived/` cache; delete `CDNManager` provider code, `imageUtils`, and
    `src/lib/image-optimization.ts` (ADR-0024); drop the deprecated
    `images.domains` array in `next.config.js` while touching image config.

## Risks and Mitigations

- **Broken historical URLs** after migration → migration rewrites all known DB
  columns; add a temporary 308 redirect from `/uploads/media/:file` to the new
  route for one release; grep post/variant content for embedded `/uploads/`
  strings during migration dry-run.
- **Large-file memory pressure** (current routes buffer whole files) →
  streaming in the driver interface from day one; enforce existing size limits
  at the route.
- **ClamAV operational weight** (~1GB RAM, signature updates) → run only in
  prod compose profile; dev default is `scanResult = null` with
  attachment-disposition serving; if the owner descopes it, execute the
  drop-fields migration instead — the one forbidden state is fake `'pending'`.
- **k8s 3-replica manifests with a ReadWriteOnce PVC** → local driver is
  documented single-replica-only; ADR-0022 gates any multi-replica deployment
  on `STORAGE_DRIVER=s3`.
- **Auth regression risk while unifying routes** → contract tests for 401/403
  on cross-workspace access and guest-ticket access before deleting the old
  routes (ADR-0021).

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — the
  `storageKey` and scan-field changes ship as real migrations.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — `/api/files`
  and the rebuilt upload route use the shared session/workspace helpers.
- ADR-0004: Platform Authorization Model and RBAC Enforcement — role matrix
  for upload/delete (OWNER/ADMIN/PUBLISHER) and read access.
- ADR-0005: API Security Hardening — SSRF closure, cache-header fixes, and
  upload validation land under its umbrella.
- ADR-0008: Background Jobs and the Publishing Pipeline — hosts the
  `scan-attachment` processor and future async media processing.
- ADR-0011: Support Subsystem Remediation — defines ticket/guest access rules
  the serving route delegates to; consumes the private `tickets/*` keys.
- ADR-0020: Client Portal and Shareable Reports — will need signed/public link
  semantics on top of this service.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — volumes, MinIO
  and ClamAV services, migration runbook.
- ADR-0023: Observability — serving latency/throughput metrics that would
  trigger the nginx/presigned-URL offload.
- ADR-0024: Codebase Hygiene — removal of `/api/upload`, `CDNManager` provider
  code, and `src/lib/image-optimization.ts`.
