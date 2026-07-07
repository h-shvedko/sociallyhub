"use client"

// ADR-0019 Track B — real billing page.
// Everything rendered here comes from GET /api/billing/subscription (live
// Subscription + usage data) or from the shared plan catalog in
// src/lib/billing/plans.ts. No mock invoices, no fake payment methods, no
// hardcoded usage numbers. When Stripe is not configured the page says so
// plainly instead of pretending checkout works.

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { ToastContainer } from "@/components/ui/toast"
import {
  PLAN_LIMITS,
  PLAN_PRICES_USD,
  type LimitKey,
  type PlanTierKey,
} from "@/lib/billing/plans"
import {
  CreditCard,
  Calendar,
  Check,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types for the /api/billing/subscription response (defensive: every field is
// optional and normalized below so a partial payload never fabricates data).
// ---------------------------------------------------------------------------

interface EntitlementsDto {
  tier?: string
  status?: string
  limits?: Partial<Record<LimitKey, number | null>>
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
  stripeConfigured?: boolean
}

interface PlanDto {
  tier?: string
  name?: string
  priceUsd?: number
  limits?: Partial<Record<LimitKey, number | null>>
}

interface InvoiceDto {
  id?: string
  number?: string | null
  date?: string | number | null
  created?: string | number | null
  status?: string | null
  currency?: string | null
  amountCents?: number | null
  amountDue?: number | null
  amount_due?: number | null
  total?: number | null
  amount?: number | null
  hostedInvoiceUrl?: string | null
  hosted_invoice_url?: string | null
}

interface BillingData {
  entitlements: EntitlementsDto | null
  usage: Partial<Record<LimitKey, number>> | null
  plans: PlanDto[]
  invoices: InvoiceDto[]
}

const TIER_ORDER: PlanTierKey[] = ["FREE", "PRO", "BUSINESS"]

const TIER_LABELS: Record<PlanTierKey, string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
}

const LIMIT_LABELS: Record<LimitKey, string> = {
  socialAccounts: "Social accounts",
  postsPerMonth: "Posts this month",
  teamSeats: "Team seats",
  aiCreditsPerMonth: "AI credits this month",
}

const LIMIT_KEYS: LimitKey[] = [
  "socialAccounts",
  "postsPerMonth",
  "teamSeats",
  "aiCreditsPerMonth",
]

function normalizeTier(tier: string | undefined | null): PlanTierKey {
  const t = (tier || "").toUpperCase()
  return (TIER_ORDER as string[]).includes(t) ? (t as PlanTierKey) : "FREE"
}

function planFeatures(limits: Partial<Record<LimitKey, number | null>>): string[] {
  const fmt = (n: number | null | undefined, singular: string, plural: string) =>
    n === null ? `Unlimited ${plural}` : `${n ?? 0} ${n === 1 ? singular : plural}`
  return [
    fmt(limits.socialAccounts, "social account", "social accounts"),
    fmt(limits.postsPerMonth, "post / month", "posts / month"),
    fmt(limits.teamSeats, "team seat", "team seats"),
    fmt(limits.aiCreditsPerMonth, "AI credit / month", "AI credits / month"),
  ]
}

function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") {
    // Stripe timestamps are unix seconds; anything past year ~2100 in seconds
    // is already milliseconds.
    return new Date(value < 10_000_000_000 ? value * 1000 : value)
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function invoiceAmountLabel(inv: InvoiceDto): string {
  // Stripe amounts are integer cents; take the first cents-denominated field.
  const cents =
    inv.amountCents ?? inv.amountDue ?? inv.amount_due ?? inv.total ?? inv.amount
  if (typeof cents !== "number") return "—"
  const currency = (inv.currency || "usd").toUpperCase()
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export default function BillingPage() {
  const { data: session } = useSession()
  const { toasts, toast, removeToast } = useToast()

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [stripeNotice, setStripeNotice] = useState(false)

  // Resolve the current workspace the same way other dashboard pages do:
  // session first, then /api/user/workspace.
  useEffect(() => {
    if (!session?.user) return
    const sessionWorkspaceId = (session.user as { workspaceId?: string }).workspaceId
    if (sessionWorkspaceId) {
      setWorkspaceId(sessionWorkspaceId)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/user/workspace")
        if (!res.ok) throw new Error(`Workspace lookup failed (${res.status})`)
        const body = await res.json()
        if (!cancelled) {
          if (body.workspaceId) {
            setWorkspaceId(body.workspaceId)
          } else {
            setLoadError("No workspace found for your account.")
            setLoading(false)
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not determine your current workspace.")
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  const fetchBilling = useCallback(async (wsId: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/billing/subscription?workspaceId=${encodeURIComponent(wsId)}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to load subscription (${res.status})`)
      }
      const body = await res.json()
      const entitlements: EntitlementsDto | null =
        body.entitlements ?? (body.tier ? body : null)
      let invoices: InvoiceDto[] = Array.isArray(body.invoices) ? body.invoices : []

      // Some deployments serve invoices from a dedicated endpoint; tolerate
      // its absence — an empty list stays an empty list, never fabricated.
      if (!Array.isArray(body.invoices)) {
        try {
          const invRes = await fetch(
            `/api/billing/invoices?workspaceId=${encodeURIComponent(wsId)}`
          )
          if (invRes.ok) {
            const invBody = await invRes.json()
            if (Array.isArray(invBody.invoices)) invoices = invBody.invoices
            else if (Array.isArray(invBody)) invoices = invBody
          }
        } catch {
          // No invoice endpoint — leave the honest empty state.
        }
      }

      setData({
        entitlements,
        usage: body.usage ?? null,
        plans: Array.isArray(body.plans) ? body.plans : [],
        invoices,
      })
      if (entitlements && entitlements.stripeConfigured === false) {
        setStripeNotice(true)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load billing data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (workspaceId) fetchBilling(workspaceId)
  }, [workspaceId, fetchBilling])

  // --- derived state ---------------------------------------------------------

  const ent = data?.entitlements ?? null
  const tier = normalizeTier(ent?.tier)
  const status = (ent?.status || "ACTIVE").toUpperCase()
  const limits: Record<LimitKey, number | null> = {
    ...PLAN_LIMITS[tier],
    ...(ent?.limits ?? {}),
  }
  const trialEndsAt = parseDate(ent?.trialEndsAt ?? null)
  const currentPeriodEnd = parseDate(ent?.currentPeriodEnd ?? null)
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null

  // Plan catalog: prefer the API's plans, fall back to the shared contract
  // constants in src/lib/billing/plans.ts (real limits, display prices).
  const planCards = TIER_ORDER.map((t) => {
    const fromApi = data?.plans.find((p) => normalizeTier(p.tier) === t)
    return {
      tier: t,
      name: fromApi?.name || TIER_LABELS[t],
      priceUsd: typeof fromApi?.priceUsd === "number" ? fromApi.priceUsd : PLAN_PRICES_USD[t],
      limits: { ...PLAN_LIMITS[t], ...(fromApi?.limits ?? {}) },
    }
  })

  // --- actions ---------------------------------------------------------------

  const handleStripeAction = async (
    endpoint: "checkout" | "portal",
    body: Record<string, unknown>,
    loadingKey: string
  ) => {
    if (!workspaceId) return
    setActionLoading(loadingKey)
    try {
      const res = await fetch(`/api/billing/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...body }),
      })
      const resBody = await res.json().catch(() => ({}))
      if (res.status === 503 && resBody.error === "stripe_not_configured") {
        setStripeNotice(true)
        return
      }
      if (!res.ok || !resBody.url) {
        throw new Error(resBody.error || `Billing request failed (${res.status})`)
      }
      window.location.href = resBody.url
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Billing request failed",
        endpoint === "checkout" ? "Checkout failed" : "Billing portal unavailable"
      )
    } finally {
      setActionLoading(null)
    }
  }

  const startCheckout = (target: "PRO" | "BUSINESS") =>
    handleStripeAction("checkout", { tier: target }, `checkout:${target}`)

  const openPortal = (loadingKey = "portal") =>
    handleStripeAction("portal", {}, loadingKey)

  // --- render helpers --------------------------------------------------------

  const statusBadge = () => {
    if (status === "TRIALING") {
      return (
        <Badge variant="default">
          {TIER_LABELS[tier]} trial
          {trialDaysLeft !== null
            ? ` — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
            : ""}
        </Badge>
      )
    }
    if (status === "PAST_DUE") return <Badge variant="destructive">Past due</Badge>
    if (status === "CANCELED") return <Badge variant="secondary">Canceled</Badge>
    if (status === "INCOMPLETE") return <Badge variant="secondary">Incomplete</Badge>
    return (
      <Badge variant={tier === "FREE" ? "secondary" : "default"}>
        {TIER_LABELS[tier]} plan
      </Badge>
    )
  }

  const usageMeter = (key: LimitKey) => {
    const max = limits[key]
    const current = data?.usage?.[key]
    const hasUsage = typeof current === "number"
    const pct =
      hasUsage && typeof max === "number" && max > 0
        ? Math.min(100, (current / max) * 100)
        : 0
    return (
      <div key={key}>
        <div className="flex justify-between text-sm mb-1">
          <span>{LIMIT_LABELS[key]}</span>
          <span>
            {hasUsage ? current : "—"} / {max === null ? "Unlimited" : max}
          </span>
        </div>
        {max === null ? (
          <p className="text-xs text-muted-foreground">No limit on your plan</p>
        ) : (
          <Progress value={pct} className="h-2" />
        )}
      </div>
    )
  }

  // --- page ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plan &amp; Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription, usage, and invoices.
        </p>
      </div>

      {stripeNotice && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            Payments are not configured on this deployment. Plan upgrades and the
            billing portal are unavailable until Stripe is set up by the operator.
          </span>
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading billing information…</span>
          </CardContent>
        </Card>
      )}

      {!loading && loadError && (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
            <p className="text-sm text-red-600">{loadError}</p>
            {workspaceId && (
              <Button variant="outline" size="sm" onClick={() => fetchBilling(workspaceId)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !loadError && (
        <>
          {status === "PAST_DUE" && (
            <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-sm text-red-800">
                  Your last payment failed. Update your payment method to keep your{" "}
                  {TIER_LABELS[tier]} plan.
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading !== null}
                onClick={() => openPortal("portal:fix")}
              >
                {actionLoading === "portal:fix" && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Fix payment
              </Button>
            </div>
          )}

          {/* Current plan + usage */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Current Plan
                  </CardTitle>
                  <CardDescription>
                    Your current subscription and usage against plan limits
                  </CardDescription>
                </div>
                {statusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{TIER_LABELS[tier]} plan</h3>
                  <p className="text-muted-foreground">
                    {tier === "FREE"
                      ? "Free forever — upgrade for higher limits"
                      : `$${PLAN_PRICES_USD[tier]}/month`}
                  </p>
                  {status === "TRIALING" && trialEndsAt && (
                    <p className="text-sm text-muted-foreground">
                      Trial ends {trialEndsAt.toLocaleDateString()}
                    </p>
                  )}
                  {ent?.cancelAtPeriodEnd && currentPeriodEnd && (
                    <p className="text-sm text-amber-700">
                      Cancels at period end — access until{" "}
                      {currentPeriodEnd.toLocaleDateString()}
                    </p>
                  )}
                  {!ent?.cancelAtPeriodEnd &&
                    currentPeriodEnd &&
                    tier !== "FREE" &&
                    status !== "TRIALING" && (
                      <p className="text-sm text-muted-foreground">
                        Renews {currentPeriodEnd.toLocaleDateString()}
                      </p>
                    )}
                </div>
                <Button
                  variant="outline"
                  disabled={actionLoading !== null}
                  onClick={() => openPortal()}
                >
                  {actionLoading === "portal" && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Manage billing
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Usage</h4>
                <div className="space-y-3">{LIMIT_KEYS.map(usageMeter)}</div>
                {!data?.usage && (
                  <p className="text-xs text-muted-foreground">
                    Usage data is unavailable right now.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plans */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Plans</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {planCards.map((plan) => {
                const isCurrent = plan.tier === tier
                const isPaid = plan.tier !== "FREE"
                return (
                  <Card
                    key={plan.tier}
                    className={`relative ${plan.tier === "PRO" ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.tier === "PRO" && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                        Most Popular
                      </Badge>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-4xl font-bold">${plan.priceUsd}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 mb-6">
                        {planFeatures(plan.limits).map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <Button className="w-full" variant="secondary" disabled>
                          Current plan
                        </Button>
                      ) : isPaid ? (
                        <Button
                          className="w-full"
                          disabled={actionLoading !== null}
                          onClick={() => startCheckout(plan.tier as "PRO" | "BUSINESS")}
                        >
                          {actionLoading === `checkout:${plan.tier}` && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Upgrade to {plan.name}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant="outline"
                          disabled={actionLoading !== null}
                          onClick={() => openPortal("portal:downgrade")}
                        >
                          {actionLoading === "portal:downgrade" && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Downgrade via billing portal
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Your billing history from Stripe</CardDescription>
            </CardHeader>
            <CardContent>
              {data && data.invoices.length > 0 ? (
                <div className="space-y-3">
                  {data.invoices.map((inv, idx) => {
                    const date = parseDate(inv.date ?? inv.created ?? null)
                    const url = inv.hostedInvoiceUrl ?? inv.hosted_invoice_url ?? null
                    const invStatus = (inv.status || "").toLowerCase()
                    return (
                      <div
                        key={inv.id || inv.number || idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {inv.number || inv.id || "Invoice"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {date ? date.toLocaleDateString() : "Date unavailable"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">{invoiceAmountLabel(inv)}</p>
                            {invStatus && (
                              <Badge
                                variant={
                                  invStatus === "paid"
                                    ? "secondary"
                                    : invStatus === "open"
                                      ? "default"
                                      : "destructive"
                                }
                              >
                                {invStatus}
                              </Badge>
                            )}
                          </div>
                          {url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                                <span className="sr-only">Open invoice</span>
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No invoices yet</p>
                  <p className="text-sm">
                    Invoices appear here after your first payment on a paid plan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
