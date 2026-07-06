// TOMBSTONE (ADR-0016, Phase 0 "Disarm and de-lie").
//
// This endpoint was DELETED. It previously ran a hardcoded rule engine that
// only understood 4 of 12 security categories, then persisted the results as
// authoritative-looking auditResult / securityScore rows on
// SecurityConfiguration. Presenting an incomplete, invented audit as an
// authoritative security posture is misinformation.
//
// A real security scanner may return in a future ADR. Until then this
// returns 410 Gone and touches nothing.
import { NextRequest } from 'next/server'
import { jsonError } from '@/lib/api/respond'

// POST /api/admin/settings/security/audit - removed (ADR-0016)
export async function POST(request: NextRequest) {
  return jsonError(410, 'This endpoint was removed by ADR-0016: a hardcoded rule engine that persisted authoritative-looking audit results is misinformation. A real security scanner may return in a future ADR.')
}
