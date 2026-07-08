#!/usr/bin/env bash
#
# ADR-0025 D4 CI guard: fail if any committed SOURCE file contains a demo/test
# password LITERAL. No shared/committed passwords may live in the codebase —
# the demo user password comes from DEMO_USER_PASSWORD (env), the generated
# mock users get per-user crypto.randomBytes passwords, and generated admin
# passwords are printed ONCE at seed time, never committed.
#
# Scans source trees only: prisma/ src/ scripts/. Intentionally NOT scanned:
#   - docs/                        (may reference the strings in prose/history)
#   - .env*                        (gitignored / example files, not committed)
#   - node_modules/ .next/ dist/   (vendored / build output)
#   - this script itself           (it must name the forbidden literals to grep)
#
# Exit 1 (listing every offending file:line) on any match; otherwise print
# "OK: no committed demo secrets" and exit 0. grep's own "no match" exit code
# (1) is handled so the script's exit code reflects PASS/FAIL, not grep's.

set -uo pipefail

# Resolve the repo root from this script's location so it runs from anywhere
# (CI, host, `docker compose exec`).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SELF="$(basename "${BASH_SOURCE[0]}")"

# Only scan the directories that exist.
SCAN_DIRS=()
for d in prisma src scripts; do
  [ -d "$d" ] && SCAN_DIRS+=("$d")
done

if [ "${#SCAN_DIRS[@]}" -eq 0 ]; then
  echo "OK: no committed demo secrets"
  exit 0
fi

hits=""
for pat in "password123" "demo123456"; do
  # -r recursive, -n line numbers, -F fixed string (literal, not regex).
  # `|| true` swallows grep's exit 1 (no match) so `set -e`-free logic below
  # keys off the accumulated output, not grep's exit code.
  out="$(grep -rnF \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
    --exclude="$SELF" \
    -- "$pat" "${SCAN_DIRS[@]}" 2>/dev/null)" || true
  if [ -n "$out" ]; then
    hits+="$out"$'\n'
  fi
done

if [ -n "$hits" ]; then
  echo "❌ Committed demo/test secret literal(s) found — ADR-0025 D4 forbids committed passwords:"
  printf '%s' "$hits" | sed '/^$/d' | sort -u
  echo ""
  echo "Fix: move the value to an env var (DEMO_USER_PASSWORD / ADMIN_INITIAL_PASSWORD / E2E_USER_PASSWORD)"
  echo "     or generate it at runtime (crypto.randomBytes). Do not commit constant passwords."
  exit 1
fi

echo "OK: no committed demo secrets"
exit 0
