#!/usr/bin/env bash
#
# check-no-fabricated-metrics.sh  (ADR-0023, Decision item 6)
# -----------------------------------------------------------------------------
# CI guard: no fabricated business/ops metrics may return to the API layer.
#
# It greps for `Math.random(` in `src/app/api/**` (.ts/.tsx) and FAILS (exit 1)
# on any real call that is NOT in the allowlist below. Doc-comment *mentions* of
# the old code (e.g. " * the old Math.random() mock is gone") are ignored so that
# already-cleaned routes do not have to be allowlisted — the guard stays active
# for their real code.
#
# The allowlist is a set of fixed-string path fragments (grep -F, robust). Each
# entry is a documented exception; entries owned by other ADRs are burned down as
# those ADRs execute. When a listed file's Math.random() is removed, delete its
# line here too.
#
# Allowlisted because the usage is LEGITIMATE (non-crypto ID generation):
#   - src/app/api/campaigns/route.ts
#   - src/app/api/campaigns/[id]/route.ts
#   - src/app/api/clients/[id]/messages/route.ts
#   - src/app/api/support/chat/route.ts
#   - src/app/api/support/tickets/route.ts
#   - src/app/api/accounts/connect/route.ts
#
# Allowlisted because OWNED BY ANOTHER ADR (deferred / known / in-flight):
#   - src/app/api/community/            -> ADR-0013 deferral (entire subtree, 404'd)
#   - src/app/api/documentation/        -> ADR-0014 deferral (entire subtree, 404'd)
#   - src/app/api/client-reports/[id]/download/route.ts -> ADR-0025 report-body mock fallback
#   - src/app/api/client-reports/[id]/send/route.ts     -> ADR-0025 report-body mock fallback
#   - src/app/api/admin/settings/integrations/[id]/test/route.ts -> comment-only, 410 tombstone
#
# Deliberately NOT allowlisted (guard stays active for real reintroductions):
#   - src/app/api/analytics/platform/route.ts  -> fabricated fields deleted (ADR-0023 item 10)
#   - src/app/api/clients/stats/route.ts        -> fabricated fields deleted (ADR-0023 item 11)
#   - src/app/api/monitoring/metrics/route.ts   -> cleaned by ADR-0023 Phase 2 item 9 (registry-derived)
#   - src/app/api/jobs/health/route.ts          -> cleaned; only a doc-comment mention remains
#   - src/app/api/client-reports/schedules/run/route.ts -> cleaned; only a doc-comment mention remains
# -----------------------------------------------------------------------------
set -uo pipefail

# Run from the repo root regardless of the caller's CWD.
if root=$(git rev-parse --show-toplevel 2>/dev/null); then
  cd "$root"
else
  cd "$(dirname "$0")/.."
fi

ALLOWLIST=(
  # --- legitimate non-crypto ID generation ---
  "src/app/api/campaigns/route.ts"
  "src/app/api/campaigns/[id]/route.ts"
  "src/app/api/clients/[id]/messages/route.ts"
  "src/app/api/support/chat/route.ts"
  "src/app/api/support/tickets/route.ts"
  "src/app/api/accounts/connect/route.ts"
  # --- owned by other ADRs (deferred / known / in-flight) ---
  "src/app/api/community/"
  "src/app/api/documentation/"
  "src/app/api/client-reports/[id]/download/route.ts"
  "src/app/api/client-reports/[id]/send/route.ts"
  "src/app/api/admin/settings/integrations/[id]/test/route.ts"
)

# 1. Find `Math.random(` in API source files.
# 2. Drop lines that are pure doc/line comments (leading `*`, `//`, or `/*`) so a
#    mention of the retired code is not treated as a live call.
# 3. Drop allowlisted files (fixed-string match on the path fragment).
offenders=$(
  grep -rn --include='*.ts' --include='*.tsx' 'Math.random(' src/app/api/ 2>/dev/null \
    | grep -vE ':[0-9]+:[[:space:]]*(\*|//|/\*)' \
    | grep -vF -f <(printf '%s\n' "${ALLOWLIST[@]}") \
    || true
)

if [ -n "$offenders" ]; then
  echo "FAIL: fabricated metric(s) via Math.random() outside the allowlist:"
  echo "$offenders" | sed 's/^/  /'
  echo
  echo "Allowlist (documented exceptions — see the header of this script):"
  printf '  %s\n' "${ALLOWLIST[@]}"
  echo
  echo "If this is a real metric, replace it with a real source or delete it (ADR-0023)."
  echo "If it is legitimate (ID generation) or owned by another ADR, add it above with a reason."
  exit 1
fi

echo "OK: no unowned fabricated metrics"
exit 0
