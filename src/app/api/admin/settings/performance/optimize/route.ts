// TOMBSTONE (ADR-0016, Phase 0 "Disarm and de-lie").
//
// This endpoint was DELETED. It previously mutated live
// PerformanceConfiguration rows (and wrote SystemHealthMetric records)
// based on a hardcoded, fabricated "optimization analysis", with dryRun
// defaulting to false — i.e. a single POST silently rewrote production
// configuration from invented numbers. That is dangerous and dishonest.
//
// A real performance-tuning tool may return under ADR-0023 (Observability).
// Until then this returns 410 Gone and touches nothing.
import { NextRequest } from 'next/server'
import { jsonError } from '@/lib/api/respond'

// POST /api/admin/settings/performance/optimize - removed (ADR-0016)
export async function POST(request: NextRequest) {
  return jsonError(410, 'This endpoint was removed by ADR-0016: it mutated live configuration from fabricated analysis. A real performance-tuning tool may return under ADR-0023.')
}
