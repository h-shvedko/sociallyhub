import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { BusinessLogger } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

async function getClientsHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search')

    // Get user's workspace
    const userId = await normalizeUserId(session.user.id)
    
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const workspaceId = userWorkspace.workspaceId

    // Build where clause for search
    const whereClause: any = {
      workspaceId
    }

    if (search) {
      whereClause.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Get clients from database
    const [clients, totalCount] = await Promise.all([
      prisma.client.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit,
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
              username: true
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
      }),
      prisma.client.count({
        where: whereClause
      })
    ])

    // Transform clients to match frontend expectations
    const formattedClients = clients.map(client => ({
      id: client.id,
      workspaceId: client.workspaceId,
      name: client.name,
      email: '', // Not in current schema - could be added later
      company: client.name, // Using name as company for now
      industry: 'Technology', // Default - could be added to schema later
      status: 'ACTIVE', // Default - could be added to schema later
      onboardingStatus: 'COMPLETED', // Default - could be added to schema later
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      tags: client.labels || [],
      socialAccountsCount: client.socialAccounts.length,
      campaignsCount: client.campaigns.length,
      postsCount: client.posts.length,
      workspace: client.workspace
    }))

    BusinessLogger.logClientListViewed(userId, workspaceId, {
      totalClients: totalCount,
      filters: { search }
    })

    return NextResponse.json({
      clients: formattedClients,
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createClientHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, tags } = body

    if (!name) {
      return NextResponse.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 })
    }

    // Get user's workspace
    const userId = await normalizeUserId(session.user.id)
    
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

    // Create client in database
    const newClient = await prisma.client.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        name,
        labels: tags || []
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        }
      }
    })

    BusinessLogger.logClientCreated(newClient.id, userId, userWorkspace.workspaceId)

    // Format response to match frontend expectations
    const formattedClient = {
      id: newClient.id,
      workspaceId: newClient.workspaceId,
      name: newClient.name,
      email: '',
      company: newClient.name,
      industry: 'Technology',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdAt: newClient.createdAt,
      updatedAt: newClient.updatedAt,
      tags: newClient.labels || [],
      socialAccountsCount: 0,
      campaignsCount: 0,
      postsCount: 0,
      workspace: newClient.workspace
    }

    return NextResponse.json(formattedClient, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientsHandler, 'clients-list')
export const POST = withLogging(createClientHandler, 'clients-create')