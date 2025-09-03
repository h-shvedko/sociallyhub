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
  }
}