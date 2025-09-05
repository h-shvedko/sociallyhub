import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/accounts/[id] - Get specific social account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: accountId } = await params

    // Get user's workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get the specific account
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: userWorkspace.workspaceId
      },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Get account statistics
    const [postsCount, inboxItemsCount] = await Promise.all([
      prisma.postVariant.count({
        where: { socialAccountId: account.id }
      }),
      prisma.inboxItem.count({
        where: { socialAccountId: account.id }
      })
    ])

    return NextResponse.json({
      ...account,
      // Don't expose sensitive token data
      accessToken: undefined,
      refreshToken: undefined,
      stats: {
        postsCount,
        inboxItemsCount
      }
    })
  } catch (error) {
    console.error('Account fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

// PUT /api/accounts/[id] - Update social account settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: accountId } = await params
    const body = await request.json()

    // Get user's workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Verify account exists and belongs to workspace
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Update account settings (only allow certain fields to be updated)
    const updatedAccount = await prisma.socialAccount.update({
      where: {
        id: accountId
      },
      data: {
        displayName: body.displayName || existingAccount.displayName,
        handle: body.handle || existingAccount.handle,
        clientId: body.clientId || existingAccount.clientId,
        status: body.status || existingAccount.status,
        metadata: body.metadata || existingAccount.metadata
      },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      ...updatedAccount,
      // Don't expose sensitive token data
      accessToken: undefined,
      refreshToken: undefined
    })
  } catch (error) {
    console.error('Account update error:', error)
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounts/[id] - Delete social account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: accountId } = await params

    // Get user's workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] } // Only owners and admins can delete accounts
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Verify account exists and belongs to workspace
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Delete the account
    await prisma.socialAccount.delete({
      where: {
        id: accountId
      }
    })

    console.log(`🗑️ Deleted social account ${existingAccount.displayName} (${existingAccount.provider})`)

    return NextResponse.json({ 
      success: true,
      message: 'Account deleted successfully'
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}