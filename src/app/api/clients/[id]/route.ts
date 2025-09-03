import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

async function getClientHandler(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = params.id
    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: userWorkspace.workspaceId
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        },
        socialAccounts: {
          select: {
            id: true,
            provider: true,
            handle: true
          }
        },
        campaigns: {
          select: {
            id: true,
            name: true
          }
        },
        posts: {
          select: {
            id: true
          }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Format response
    const formattedClient = {
      id: client.id,
      workspaceId: client.workspaceId,
      name: client.name,
      email: '', // Not in current schema
      company: client.name,
      industry: 'Technology', // Default
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      tags: client.labels || [],
      socialAccountsCount: client.socialAccounts.length,
      campaignsCount: client.campaigns.length,
      postsCount: client.posts.length,
      workspace: client.workspace
    }

    return NextResponse.json(formattedClient)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateClientHandler(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = params.id
    const body = await req.json()
    const { workspaceId, name, tags, notes, ...otherFields } = body

    if (!name) {
      return NextResponse.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 })
    }

    const userId = await normalizeUserId(session.user.id)

    // Verify user has access to this workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Update client
    const updatedClient = await prisma.client.update({
      where: {
        id: clientId,
        workspaceId
      },
      data: {
        name,
        labels: tags || [],
        // Add other fields as needed when schema is expanded
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        },
        socialAccounts: {
          select: {
            id: true,
            provider: true,
            handle: true
          }
        },
        campaigns: {
          select: {
            id: true,
            name: true
          }
        },
        posts: {
          select: {
            id: true
          }
        }
      }
    })

    // Format response
    const formattedClient = {
      id: updatedClient.id,
      workspaceId: updatedClient.workspaceId,
      name: updatedClient.name,
      email: '', // Not in current schema
      company: updatedClient.name,
      industry: 'Technology', // Default
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdAt: updatedClient.createdAt,
      updatedAt: updatedClient.updatedAt,
      tags: updatedClient.labels || [],
      socialAccountsCount: updatedClient.socialAccounts.length,
      campaignsCount: updatedClient.campaigns.length,
      postsCount: updatedClient.posts.length,
      workspace: updatedClient.workspace
    }

    console.log('✅ Client updated successfully:', { clientId, userId, workspaceId })

    return NextResponse.json(formattedClient)
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function deleteClientHandler(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = params.id
    const body = await req.json()
    const { workspaceId } = body

    const userId = await normalizeUserId(session.user.id)

    // Verify user has access to this workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] } // Only owners and admins can delete
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if client exists and belongs to workspace
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Delete client (this will cascade to related records if configured)
    await prisma.client.delete({
      where: {
        id: clientId
      }
    })

    console.log('✅ Client deleted successfully:', { clientId, userId, workspaceId })

    return NextResponse.json({ success: true, message: 'Client deleted successfully' })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientHandler, 'client-get')
export const PUT = withLogging(updateClientHandler, 'client-update')
export const DELETE = withLogging(deleteClientHandler, 'client-delete')
