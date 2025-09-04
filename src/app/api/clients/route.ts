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
      email: client.email || '', // Use real email from database
      company: client.company || client.name, // Use real company if available
      industry: client.industry || '', // Use real industry from database
      website: client.website || '',
      phone: client.phone || '',
      logo: client.logo || '',
      status: client.status || 'ACTIVE', // Use real status from database
      notes: client.notes || '',
      onboardingStatus: 'COMPLETED', // Default for now
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      tags: client.labels || [],
      socialAccountsCount: client.socialAccounts.length,
      campaignsCount: client.campaigns.length,
      postsCount: client.posts.length,
      workspace: client.workspace
    }))

    // Log client list view (BusinessLogger.logClientListViewed not implemented yet)
    console.log('📋 Client list viewed:', { userId, workspaceId, totalClients: totalCount, filters: { search } })

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
    const { name, email, phone, company, industry, website, tags } = body

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
        email: email || null,
        phone: phone || null,
        company: company || null,
        industry: industry || null,
        website: website || null,
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

    // Log client creation for analytics (BusinessLogger.logClientCreated not implemented yet)
    console.log('✅ Client created successfully:', { clientId: newClient.id, userId, workspaceId: userWorkspace.workspaceId })

    // Format response to match frontend expectations
    const formattedClient = {
      id: newClient.id,
      workspaceId: newClient.workspaceId,
      name: newClient.name,
      email: newClient.email || '',
      company: newClient.company || newClient.name,
      industry: newClient.industry || '',
      website: newClient.website || '',
      phone: newClient.phone || '',
      logo: newClient.logo || '',
      status: newClient.status || 'ACTIVE',
      notes: newClient.notes || '',
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