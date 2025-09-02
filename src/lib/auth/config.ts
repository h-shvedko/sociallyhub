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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}