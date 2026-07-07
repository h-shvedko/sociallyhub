import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials")
        }

        try {
          console.log(`Login attempt for email: ${credentials.email}`)
          
          // Always use database for authentication - no hardcoded credentials
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          })

          if (!user) {
            console.log(`User not found in database: ${credentials.email}`)
            throw new Error("Invalid credentials")
          }

          console.log(`User found: ${user.email}, has password: ${!!user.password}`)

          if (!user.password) {
            console.log("User exists but has no password (possibly OAuth user)")
            throw new Error("Invalid credentials")
          }

          console.log(`Comparing password for ${user.email}...`)
          console.log(`Password hash length: ${user.password.length}`)
          console.log(`Password hash starts with: ${user.password.substring(0, 10)}`)
          
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          
          console.log(`Password comparison result: ${isPasswordValid}`)

          if (!isPasswordValid) {
            console.log("❌ Password comparison failed")
            throw new Error("Invalid credentials")
          }
          
          console.log("✅ Password comparison successful")

          // Check if email is verified (unless it's demo user or development environment)
          if (!user.emailVerified && process.env.NODE_ENV !== 'development') {
            console.log("❌ Email not verified")
            throw new Error("Please verify your email address before signing in. Check your email for a verification link.")
          }

          // Return user data from database
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            emailVerified: user.emailVerified,
          }
        } catch (error) {
          console.error("Auth error:", error)
          throw new Error("Authentication failed")
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    error: "/auth/error",
  },
  callbacks: {
    // ADR-0004 "claim for UI, DB for API": at sign-in we copy
    // User.isPlatformAdmin from the DATABASE into the JWT so layouts and
    // client components can gate navigation without an extra query. The
    // claim is UI-only — it goes stale on revocation until the token
    // expires, so API handlers always re-check the DB via
    // requirePlatformAdmin() (src/lib/auth/session.ts).
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { isPlatformAdmin: true },
          })
          token.isPlatformAdmin = dbUser?.isPlatformAdmin === true
        } catch (error) {
          // Never block sign-in on the claim lookup; default to the safe
          // value. Enforcement happens in the API helpers regardless.
          console.error("Failed to load isPlatformAdmin claim:", error)
          token.isPlatformAdmin = false
        }
        // ADR-0020 default-deny: a user whose EVERY membership is
        // CLIENT_VIEWER is a portal-only client contact. The edge middleware
        // uses this claim to 403 all /api/* outside the portal allowlist,
        // because ~175 legacy routes check membership but not role (the
        // ADR-0004 rollout is incremental). Staleness matches
        // isPlatformAdmin: recomputed at sign-in; a role change takes effect
        // on the next login. Fail direction is OPEN here (claim false on
        // error) because the routes the portal allowlist serves re-check the
        // role in the DB via requireClientViewer()/requireWorkspaceRole().
        try {
          const memberships = await prisma.userWorkspace.findMany({
            where: { userId: user.id },
            select: { role: true },
          })
          token.portalOnly =
            memberships.length > 0 &&
            memberships.every((m) => m.role === "CLIENT_VIEWER")
        } catch (error) {
          console.error("Failed to load portalOnly claim:", error)
          token.portalOnly = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.isPlatformAdmin = token.isPlatformAdmin === true
        session.user.portalOnly = token.portalOnly === true
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}