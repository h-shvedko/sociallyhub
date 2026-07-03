import NextAuth from "next-auth"
import { WorkspaceRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      currentWorkspaceId?: string
      role?: WorkspaceRole
      /**
       * ADR-0004 platform-tier claim, copied from `User.isPlatformAdmin` at
       * sign-in. "Claim for UI, DB for API": use it ONLY to gate
       * UI/navigation — API handlers must re-check the database via
       * `requirePlatformAdmin()` from `@/lib/auth` (JWT claims are not
       * revocation-safe).
       */
      isPlatformAdmin: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    currentWorkspaceId?: string
    role?: WorkspaceRole
    /** ADR-0004 platform-tier claim (UI gating only — see Session.user). */
    isPlatformAdmin?: boolean
  }
}