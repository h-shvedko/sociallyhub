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
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get user's workspace
    const userId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const actualWorkspaceId = userWorkspace.workspaceId

    // Fetch clients from database
    let whereClause: any = { workspaceId: actualWorkspaceId }
    
    // Apply filters
    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase()
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ]
    }

    const totalCount = await prisma.client.count({ where: whereClause })
    
    const clients = await prisma.client.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    const filteredClients = clients
    const paginatedClients = clients

    BusinessLogger.logClientListViewed(session.user.id, workspaceId, {
      totalClients: filteredClients.length,
      filters: { status, search }
    })

    return NextResponse.json({
      clients: paginatedClients,
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
    const {
      workspaceId,
      name,
      email,
      phone,
      company,
      industry,
      website,
      assignedUserId,
      tags,
      notes,
      contractDetails,
      billingInfo
    } = body

    if (!workspaceId || !name || !email) {
      return NextResponse.json({ 
        error: 'Missing required fields: workspaceId, name, email' 
      }, { status: 400 })
    }

    // Get user's workspace
    const userId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const actualWorkspaceId = userWorkspace.workspaceId

    // Create client in database
    const newClient = await prisma.client.create({
      data: {
        workspaceId: actualWorkspaceId,
        name,
        email,
        phone,
        company,
        industry,
        website,
        status: 'ACTIVE',
        notes,
        labels: tags || []
      }
    })

    BusinessLogger.logClientCreated(newClient.id, session.user.id, workspaceId)

    return NextResponse.json(newClient, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientsHandler, 'clients-list')
export const POST = withLogging(createClientHandler, 'clients-create')