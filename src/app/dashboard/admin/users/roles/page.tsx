import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Workspace Roles Reference | SociallyHub Admin',
}

// Static, read-only reference for the two-tier authorization model (ADR-0004).
// This page replaces the former role-management and permission-matrix screens,
// which managed Role/UserRole/Permission tables that nothing ever enforced and
// that have since been removed from the schema.

interface RoleEntry {
  role: string
  summary: string
  capabilities: string[]
}

const WORKSPACE_ROLES: RoleEntry[] = [
  {
    role: 'OWNER',
    summary: 'Full control of the workspace.',
    capabilities: [
      'Included in every role-restricted API check in the workspace.',
      'Manages team membership and member roles.',
      'Manages workspace-scoped settings alongside ADMIN.',
      'Everything PUBLISHER, ANALYST, and CLIENT_VIEWER can do.',
    ],
  },
  {
    role: 'ADMIN',
    summary: 'Workspace administration without ownership.',
    capabilities: [
      'Passes the OWNER/ADMIN checks used for team management and workspace-scoped settings.',
      'Everything PUBLISHER can do (content, clients, invoices, accounts).',
      'Does not confer any access outside this workspace.',
    ],
  },
  {
    role: 'PUBLISHER',
    summary: 'Day-to-day content operations.',
    capabilities: [
      'Passes the OWNER/ADMIN/PUBLISHER checks: posts, media uploads, templates, clients, invoices, and connected social accounts.',
      'Cannot manage team membership or workspace-scoped settings (OWNER/ADMIN only).',
    ],
  },
  {
    role: 'ANALYST',
    summary: 'Read-oriented access for reporting.',
    capabilities: [
      'Passes plain workspace-membership checks: dashboards, analytics, and other read endpoints.',
      'Fails the content-management (PUBLISHER) and administration (OWNER/ADMIN) role checks.',
    ],
  },
  {
    role: 'CLIENT_VIEWER',
    summary: 'Most limited role, intended for external client access.',
    capabilities: [
      'Passes plain workspace-membership checks only (viewing shared analytics and reports).',
      'Fails every stricter role check.',
    ],
  },
]

export default function WorkspaceRolesReferencePage() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Workspace roles reference
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          SociallyHub authorization is two-tier (ADR-0004): a per-workspace
          role on each membership, and a separate per-user platform-admin
          flag. The five workspace roles below are the entire workspace-level
          model — there are no custom roles or per-user permission overrides.
        </p>
      </div>

      <div className="space-y-4">
        {WORKSPACE_ROLES.map((entry) => (
          <div
            key={entry.role}
            className="bg-white border rounded-lg p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-800">
                {entry.role}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {entry.summary}
              </span>
            </div>
            <ul className="mt-3 space-y-1 list-disc list-inside text-sm text-gray-600">
              {entry.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-blue-900">
          Platform administration is separate
        </h3>
        <p className="text-sm text-blue-800 mt-1">
          No workspace role grants any cross-workspace power. This admin panel
          and every <code className="font-mono">/api/admin/**</code> endpoint
          are governed solely by the per-user platform-admin flag
          (<code className="font-mono">User.isPlatformAdmin</code>, ADR-0004),
          which is set per user by a platform operator — it cannot be granted
          from this UI.
        </p>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-amber-900">
          Honest scope of enforcement
        </h3>
        <p className="text-sm text-amber-800 mt-1">
          Role enforcement is currently per-route and not yet uniform: many
          API endpoints check only workspace membership, regardless of role.
          The capabilities listed above describe what role checks enforce
          where they exist today, not a finished permission matrix.
          Consolidation of every route onto the central
          <code className="font-mono"> requireWorkspaceRole()</code> helper is
          in progress (ADR-0004, Phase 3).
        </p>
      </div>
    </div>
  )
}
