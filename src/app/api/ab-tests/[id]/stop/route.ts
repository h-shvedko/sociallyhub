import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const testId = params.id

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Find the test
    const test = await prisma.contentABTest.findFirst({
      where: {
        id: testId,
        workspaceId: { in: workspaceIds }
      }
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found or access denied' }, { status: 404 })
    }

    if (test.status !== 'RUNNING') {
      return NextResponse.json({ error: 'Test is not running' }, { status: 400 })
    }

    // Update test status to COMPLETED
    const updatedTest = await prisma.contentABTest.update({
      where: { id: testId },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true,
      test: updatedTest,
      message: 'A/B test stopped successfully' 
    })
  } catch (error) {
    console.error('Error stopping A/B test:', error)
    return NextResponse.json(
      { error: 'Failed to stop A/B test' },
      { status: 500 }
    )
  }
}