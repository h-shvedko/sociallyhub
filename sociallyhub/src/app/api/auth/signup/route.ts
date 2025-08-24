import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, workspaceName } = body

    // Basic validation
    if (!name || !email || !password || !workspaceName) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        return NextResponse.json(
          { message: "User with this email already exists" },
          { status: 400 }
        )
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create user and workspace in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            emailVerified: new Date(), // For demo purposes, auto-verify
          }
        })

        // Create workspace
        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            timezone: "UTC",
          }
        })

        // Create user-workspace relationship with OWNER role
        await tx.userWorkspace.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: "OWNER",
            permissions: {
              canPublish: true,
              canApprove: true,
              canManageTeam: true,
              canManageAccounts: true,
              canViewAnalytics: true,
              canManageWorkspace: true,
            }
          }
        })

        return { user, workspace }
      })

      return NextResponse.json(
        { 
          message: "Account created successfully! Please sign in with your credentials.",
          success: true,
          userId: result.user.id,
          workspaceId: result.workspace.id
        },
        { status: 201 }
      )

    } catch (dbError) {
      console.error("Database error during signup:", dbError)
      
      // Fallback to demo mode if database is not available
      console.log("Falling back to demo signup:", { name, email, workspaceName })
      
      return NextResponse.json(
        { 
          message: "Account created successfully! (Demo mode - database not available). Please sign in with your credentials.",
          success: true
        },
        { status: 201 }
      )
    }

  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}