'use client'

import Link from 'next/link'
import { KeyRound, Info, ArrowLeft } from 'lucide-react'

// SSO administration is gated off by default (ADR-0012).
//
// The previous implementation persisted `SSOProvider`/`SSOAccount` rows and a
// self-described mock "test connection" endpoint, but NO real SSO login flow
// exists — NextAuth is not wired to these providers. Per ADR-0012 the models
// were never migrated, the `/api/admin/sso/**` routes were deleted, and this
// page renders an honest "not available" state instead of a stub form that
// pretends to configure a capability the platform does not have.
//
// To revive this surface, a future ADR must specify a real SSO login flow;
// only then should the flag below be flipped and the admin UI rebuilt against
// migrated models.
const FEATURE_SSO_ADMIN = process.env.NEXT_PUBLIC_FEATURE_SSO_ADMIN === 'true'

export default function SSOManagementPage() {
  if (!FEATURE_SSO_ADMIN) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <KeyRound className="mr-3 h-6 w-6" />
            Single Sign-On (SSO)
          </h1>
          <p className="text-gray-600 mt-1">
            Configure external identity providers for authentication.
          </p>
        </div>

        <div className="bg-white rounded-lg border p-12 text-center max-w-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Info className="h-6 w-6 text-gray-500" />
          </div>
          <h2 className="mt-4 text-lg font-medium text-gray-900">
            SSO administration is not available
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Single sign-on is not enabled on this deployment. There is no live SSO
            login flow wired to the application, so provider configuration would
            have no effect. This feature is intentionally disabled until a real SSO
            login integration is delivered.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Administrators can enable this surface via the{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">NEXT_PUBLIC_FEATURE_SSO_ADMIN</code>{' '}
            flag once a real SSO login flow is available.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/admin/settings"
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Flag on: a real SSO admin UI must be rebuilt here against migrated models
  // and live `/api/admin/sso` routes (both removed in ADR-0012). Until that
  // work lands there is deliberately nothing to render.
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border p-12 text-center max-w-2xl">
        <h2 className="text-lg font-medium text-gray-900">
          SSO administration is enabled but not yet implemented
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          The <code className="rounded bg-gray-100 px-1 py-0.5">NEXT_PUBLIC_FEATURE_SSO_ADMIN</code>{' '}
          flag is on, but the SSO management interface and its backing routes have
          not been rebuilt yet. See ADR-0012.
        </p>
      </div>
    </div>
  )
}
