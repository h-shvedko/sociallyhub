// Route-auth coverage check (ADR-0005 "API Security Hardening", Decision item 1).
//
// Statically scans every `src/app/api/**/route.ts` and classifies each exported
// HTTP handler (GET/POST/PUT/DELETE/PATCH) as COVERED or UNCOVERED, then prints a
// coverage summary and the list of uncovered files. This is the guardrail that
// makes the "TODO: add auth" failure mode visible: once every remediation-table
// endpoint is wrapped, the uncovered count trends to zero and the check can be
// flipped from WARN to FAIL (ADR-0005 Phase 4, step 13 / ADR-0022 pipeline).
//
// WARN MODE: this script ALWAYS exits 0. It never fails the build yet — it only
// publishes the covered/uncovered baseline each build. Do not add a nonzero exit
// until the ADR says to flip it.
//
// A handler is COVERED when its file does ANY of:
//   - imports/uses the `withApiAuth` wrapper (from '@/lib/api/with-api-auth'), or
//   - references one of the RECOGNIZED_GATES auth helpers, or
//   - is explicitly declared public via a top-of-file `// @api-auth: public`.
// Detection is file-level by design (a fast, dependency-free static heuristic):
// if a file uses a recognized gate anywhere, all handlers it exports are counted
// covered. It is a guardrail, not a proof (ADR-0005 Consequences) — object-level
// correctness is asserted by the ADR-0021 integration tests, not here.
//
// Usage:  npx tsx scripts/check-route-auth.ts

import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Configuration — kept at the top so the recognized set is trivial to extend.
// ---------------------------------------------------------------------------

/** Auth/authorization gates from the canonical `@/lib/auth` barrel (ADR-0003 /
 *  ADR-0004). Add new gate helper names here as they are introduced. */
const RECOGNIZED_GATES: readonly string[] = [
  'getAuthenticatedUser',
  'requireSession',
  'requireAdmin',
  'requirePlatformAdmin',
  'requireWorkspaceRole',
]

/** The declarative wrapper introduced by ADR-0005. Its presence covers a file. */
const WITH_API_AUTH_SYMBOL = 'withApiAuth'
const WITH_API_AUTH_IMPORT = '@/lib/api/with-api-auth'

/** Top-of-file marker that consciously opts a route out (reviewed allow-list). */
const PUBLIC_MARKER = /\/\/\s*@api-auth:\s*public\b/

/** HTTP method handlers Next.js recognizes in a route.ts file. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

const API_DIR = path.resolve(__dirname, '..', 'src', 'app', 'api')
const REPO_ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Filesystem walk (no dependencies).
// ---------------------------------------------------------------------------

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...findRouteFiles(full))
    } else if (entry.isFile() && entry.name === 'route.ts') {
      out.push(full)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Source analysis helpers.
// ---------------------------------------------------------------------------

/** Remove line and block comments so a gate name mentioned only in a comment
 *  (e.g. "TODO: add requireSession") does not falsely count as coverage. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // line comments (keep `://` in URLs)
}

/** Collect the distinct HTTP-method handlers a route file exports. Covers:
 *   - export [async] function GET() {}
 *   - export const GET = withLogging(...)  /  export const GET: Handler = ...
 *   - export { handler as GET, handler as POST }   /   export { GET, POST } */
function findExportedHandlers(src: string): Set<HttpMethod> {
  const found = new Set<HttpMethod>()

  const fnRe = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\b/g
  const constRe = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\b\s*(?::[^=]+)?=/g
  for (const re of [fnRe, constRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) found.add(m[1] as HttpMethod)
  }

  // Named export lists, incl. `as` aliases: `export { h as GET, POST }`.
  const exportListRe = /export\s*\{([^}]*)\}/g
  let em: RegExpExecArray | null
  while ((em = exportListRe.exec(src)) !== null) {
    for (const raw of em[1].split(',')) {
      const parts = raw.trim().split(/\s+as\s+/)
      const exportedName = (parts.length > 1 ? parts[1] : parts[0]).trim()
      if ((HTTP_METHODS as readonly string[]).includes(exportedName)) {
        found.add(exportedName as HttpMethod)
      }
    }
  }

  return found
}

type Coverage = { covered: boolean; reason: string }

function classifyFile(src: string): Coverage {
  // Public marker is a comment, so check it against the RAW source first.
  if (PUBLIC_MARKER.test(src)) {
    return { covered: true, reason: 'public' }
  }

  const code = stripComments(src)

  if (
    code.includes(WITH_API_AUTH_IMPORT) ||
    new RegExp(`\\b${WITH_API_AUTH_SYMBOL}\\b`).test(code)
  ) {
    return { covered: true, reason: 'withApiAuth' }
  }

  for (const gate of RECOGNIZED_GATES) {
    if (new RegExp(`\\b${gate}\\b`).test(code)) {
      return { covered: true, reason: gate }
    }
  }

  return { covered: false, reason: 'none' }
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main(): void {
  const files = findRouteFiles(API_DIR).sort()

  let totalHandlers = 0
  let coveredHandlers = 0
  let uncoveredHandlers = 0
  const uncoveredFiles: { file: string; methods: HttpMethod[] }[] = []

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    const handlers = findExportedHandlers(src)
    if (handlers.size === 0) continue // not a handler-exporting route file

    const methods = HTTP_METHODS.filter((m) => handlers.has(m))
    const { covered } = classifyFile(src)

    totalHandlers += methods.length
    if (covered) {
      coveredHandlers += methods.length
    } else {
      uncoveredHandlers += methods.length
      uncoveredFiles.push({ file: path.relative(REPO_ROOT, file), methods })
    }
  }

  const pct =
    totalHandlers === 0 ? 100 : (coveredHandlers / totalHandlers) * 100

  console.log('Route auth coverage check (ADR-0005) — WARN mode')
  console.log('='.repeat(56))
  console.log(`Route files scanned : ${files.length}`)
  console.log(`Handlers total      : ${totalHandlers}`)
  console.log(`Handlers covered    : ${coveredHandlers}`)
  console.log(`Handlers uncovered  : ${uncoveredHandlers}`)
  console.log(`Coverage            : ${pct.toFixed(1)}%`)

  if (uncoveredFiles.length > 0) {
    console.log('')
    console.log(`Uncovered files (${uncoveredFiles.length}):`)
    for (const { file, methods } of uncoveredFiles) {
      console.log(`  ${file}  [${methods.join(', ')}]`)
    }
  }

  console.log('')
  if (uncoveredHandlers > 0) {
    console.log(
      `WARN: ${uncoveredHandlers} uncovered handlers across ${uncoveredFiles.length} files ` +
        `(warn mode — not failing the build; ADR-0005 Phase 4 flips this to FAIL).`,
    )
  } else {
    console.log('OK: all handlers declare an access level.')
  }

  // WARN MODE: never fail the build yet.
  process.exit(0)
}

main()
