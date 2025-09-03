import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signIn } from "next-auth/react"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { message: "Verification token is required" },
        { status: 400 }
      )
    }

    // Find the verification token in database
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        token: token
      }
    })

    if (!verificationToken) {
      return NextResponse.json(
        { message: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (new Date() > verificationToken.expires) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          token: token
        }
      })
      
      return NextResponse.json(
        { message: "Verification token has expired. Please request a new verification email." },
        { status: 400 }
      )
    }

    // Find the user by email (identifier in verification token)
    const user = await prisma.user.findUnique({
      where: {
        email: verificationToken.identifier
      }
    })

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Update user's email verification status
    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        emailVerified: new Date()
      }
    })

    // Clean up the verification token
    await prisma.verificationToken.delete({
      where: {
        token: token
      }
    })

    // Return success response with user data for auto sign-in
    return NextResponse.json(
      {
        message: "Email verified successfully!",
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { message: "Internal server error during email verification" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: email
      }
    })

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: "Email is already verified" },
        { status: 400 }
      )
    }

    // Generate new verification token
    const verificationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    // Clean up any existing verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: email
      }
    })

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: expiresAt
      }
    })

    // Send verification email
    const { emailService } = await import("@/lib/notifications/email-service")
    await emailService.sendEmailVerification(user.email, user.name || 'User', verificationToken)

    return NextResponse.json(
      {
        message: "Verification email sent successfully!",
        success: true
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json(
      { message: "Failed to send verification email" },
      { status: 500 }
    )
  }
}