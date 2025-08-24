import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Build providers array conditionally
const providers = [
  // Email/Password Authentication
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      try {
        // Demo account for testing
        if (credentials.email === "demo@sociallyhub.com" && credentials.password === "demo123456") {
          return {
            id: "demo-user-id",
            email: "demo@sociallyhub.com",
            name: "Demo User",
            image: null,
          }
        }

        // Try to find user in database
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (user && user.password) {
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (isPasswordValid) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            }
          }
        }

        // Fallback: For development, allow any valid-looking email/password
        if (process.env.NODE_ENV === "development" && 
            credentials.email.includes("@") && 
            credentials.password.length >= 8) {
          return {
            id: "dev-user-" + Math.random().toString(36).substr(2, 9),
            email: credentials.email,
            name: credentials.email.split("@")[0],
            image: null,
          }
        }

        return null
      } catch (error) {
        console.error("Authorization error:", error)
        
        // If database is not available, fall back to demo mode
        if (credentials.email === "demo@sociallyhub.com" && credentials.password === "demo123456") {
          return {
            id: "demo-user-id",
            email: "demo@sociallyhub.com",
            name: "Demo User",
            image: null,
          }
        }
        
        return null
      }
    }
  }),
]

// Only add Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        
        // Get user's workspaces and current workspace
        const userWithWorkspaces = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            workspaces: {
              include: {
                workspace: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        })

        if (userWithWorkspaces?.workspaces?.length) {
          // Set first workspace as default
          const firstWorkspace = userWithWorkspaces.workspaces[0]
          token.currentWorkspaceId = firstWorkspace.workspaceId
          token.role = firstWorkspace.role
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.currentWorkspaceId = token.currentWorkspaceId as string
        session.user.role = token.role as string
      }
      return session
    }
  },

  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },

  secret: process.env.NEXTAUTH_SECRET,
}