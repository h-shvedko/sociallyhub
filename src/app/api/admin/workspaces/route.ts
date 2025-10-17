import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/workspaces - Get all workspaces with member information
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeMembers = searchParams.get('includeMembers') === 'true'
    const status = searchParams.get('status')
    const plan = searchParams.get('plan')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status.toUpperCase()
    }

    if (plan) {
      where.plan = plan.toUpperCase()
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } }
      ]
    }

    const workspaces = await prisma.workspace.findMany({
      where,
      include: {
        users: includeMembers ? {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                createdAt: true
              }
            }
          }
        } : undefined,
        teams: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                members: true
              }
            }
          }
        },
        _count: {
          select: {
            users: true,
            posts: true,
            socialAccounts: true,
            campaigns: true,
            clients: true,
            teams: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate workspace statistics
    const stats = {
      total: workspaces.length,
      active: workspaces.filter(w => w.status === 'ACTIVE').length,
      suspended: workspaces.filter(w => w.status === 'SUSPENDED').length,
      totalMembers: workspaces.reduce((sum, w) => sum + w._count.users, 0),
      plans: {
        free: workspaces.filter(w => w.plan === 'FREE').length,
        pro: workspaces.filter(w => w.plan === 'PRO').length,
        enterprise: workspaces.filter(w => w.plan === 'ENTERPRISE').length
      }
    }

    return NextResponse.json({
      workspaces,
      stats
    })
  } catch (error) {
    console.error('Failed to fetch workspaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    )
  }
}

// POST /api/admin/workspaces - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      domain,
      plan = 'FREE',
      ownerId,
      settings = {},
      timezone = 'UTC',
      locale = 'en'
    } = body

    if (!name || !ownerId) {
      return NextResponse.json(
        { error: 'Name and owner ID are required' },
        { status: 400 }
      )
    }

    // Check if owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId }
    })

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner user not found' },
        { status: 404 }
      )
    }

    // Check if domain is unique (if provided)
    if (domain) {
      const existingWorkspace = await prisma.workspace.findUnique({
        where: { domain }
      })

      if (existingWorkspace) {
        return NextResponse.json(
          { error: 'Domain already exists' },
          { status: 409 }
        )
      }
    }

    // Create workspace within a transaction
    const workspace = await prisma.$transaction(async (tx) => {
      // Create workspace
      const newWorkspace = await tx.workspace.create({
        data: {
          name,
          domain,
          plan: plan.toUpperCase(),
          settings,
          timezone,
          locale,
          status: 'ACTIVE'
        }
      })

      // Add owner to workspace
      await tx.userWorkspace.create({
        data: {
          userId: ownerId,
          workspaceId: newWorkspace.id,
          role: 'OWNER',
          joinedAt: new Date()
        }
      })

      return newWorkspace
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId: workspace.id,
        action: 'workspace_created',
        resource: 'workspace',
        resourceId: workspace.id,
        newValues: {
          name: workspace.name,
          domain: workspace.domain,
          plan: workspace.plan,
          ownerId
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json(workspace, { status: 201 })
  } catch (error) {
    console.error('Failed to create workspace:', error)
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    )
  }
}