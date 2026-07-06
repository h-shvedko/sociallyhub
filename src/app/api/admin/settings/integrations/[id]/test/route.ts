// TOMBSTONE (ADR-0016, Phase 0 "Disarm and de-lie").
//
// This endpoint was DELETED. It never actually contacted any provider — it
// returned hardcoded "Successfully connected" payloads for known providers
// and a literal `Math.random() > 0.3` dice-roll (with a fabricated
// responseTime) for CUSTOM, then wrote lastSync / errorCount to the DB based
// on that fiction. A connectivity test that invents its result is worse than
// no test.
//
// Real per-provider checks (e.g. SMTP verify, Stripe key check per ADR-0019)
// may return later. Until then this returns 410 Gone and touches nothing.
import { NextRequest } from 'next/server'
import { jsonError } from '@/lib/api/respond'

// POST /api/admin/settings/integrations/[id]/test - removed (ADR-0016)
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return jsonError(410, 'This endpoint was removed by ADR-0016: integration connectivity tests were dice-rolls. Real per-provider checks (e.g. SMTP verify, Stripe key check per ADR-0019) may return later.')
}
