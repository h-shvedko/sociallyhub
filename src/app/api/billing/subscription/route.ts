// GET /api/billing/subscription?workspaceId=... (ADR-0019 Track A).
//
// Read model for the billing page: effective entitlements, real usage
// counts, the plan catalog, and (when Stripe is configured and the
// workspace has a customer) the recent Stripe invoices. Any workspace
// member may read it — mutations (checkout/portal) are OWNER-only.

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { requireWorkspaceRole } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, PLAN_PRICES_USD } from '@/lib/billing/plans'
import { getEntitlements, getUsage } from '@/lib/billing/entitlements'
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'

interface InvoiceSummary {
  id: string
  number: string | null
  amountDue: number
  currency: string
  status: string | null
  created: string
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

function mapInvoice(invoice: Stripe.Invoice): InvoiceSummary {
  return {
    id: invoice.id ?? '',
    number: invoice.number ?? null,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    status: invoice.status ?? null,
    created: new Date(invoice.created * 1000).toISOString(),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return jsonError(400, 'workspaceId is required')
    }

    // Any member of the workspace may read billing state (no role filter).
    await requireWorkspaceRole(workspaceId)

    const [entitlements, usage, subscription] = await Promise.all([
      getEntitlements(workspaceId),
      getUsage(workspaceId),
      prisma.subscription.findUnique({
        where: { workspaceId },
        select: { stripeCustomerId: true },
      }),
    ])

    // Invoices come straight from Stripe — no local fabrication. When the
    // fetch fails we say so (invoicesUnavailable) instead of pretending the
    // history is empty.
    let invoices: InvoiceSummary[] = []
    let invoicesUnavailable = false
    if (isStripeConfigured() && subscription?.stripeCustomerId) {
      try {
        const list = await getStripe().invoices.list({
          customer: subscription.stripeCustomerId,
          limit: 12,
        })
        invoices = list.data.map(mapInvoice)
      } catch (err) {
        console.error('[billing:subscription] Failed to list Stripe invoices:', err)
        invoicesUnavailable = true
      }
    }

    return NextResponse.json({
      entitlements,
      usage,
      plans: { limits: PLAN_LIMITS, pricesUsd: PLAN_PRICES_USD },
      invoices,
      ...(invoicesUnavailable ? { invoicesUnavailable: true } : {}),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
