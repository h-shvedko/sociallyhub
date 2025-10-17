import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/teams - Get all teams with member information
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
    const workspaceId = searchParams.get('workspaceId')
    const includeMembers = searchParams.get('includeMembers') === 'true'
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {}

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        members: includeMembers ? {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        } : undefined,
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate team statistics
    const stats = {
      total: teams.length,
      totalMembers: teams.reduce((sum, t) => sum + t._count.members, 0),
      averageTeamSize: teams.length > 0
        ? Math.round(teams.reduce((sum, t) => sum + t._count.members, 0) / teams.length * 10) / 10
        : 0,
      workspaces: [...new Set(teams.map(t => t.workspaceId))].length
    }

    return NextResponse.json({
      teams,
      stats
    })
  } catch (error) {
    console.error('Failed to fetch teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}

// POST /api/admin/teams - Create new team
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
      description,
      workspaceId,
      leaderId,
      memberIds = [],
      settings = {}
    } = body

    if (!name || !workspaceId) {
      return NextResponse.json(
        { error: 'Name and workspace ID are required' },
        { status: 400 }
      )
    }

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Verify leader exists and is in workspace (if provided)
    if (leaderId) {
      const leaderInWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: leaderId,
          workspaceId
        }
      })

      if (!leaderInWorkspace) {
        return NextResponse.json(
          { error: 'Team leader must be a member of the workspace' },
          { status: 400 }
        )
      }
    }

    // Create team within a transaction
    const team = await prisma.$transaction(async (tx) => {
      // Create team
      const newTeam = await tx.team.create({
        data: {
          name,
          description,
          workspaceId,
          settings
        }
      })

      // Add leader as team leader
      if (leaderId) {
        await tx.teamMember.create({
          data: {
            userId: leaderId,
            teamId: newTeam.id,
            role: 'LEADER',
            joinedAt: new Date()
          }
        })
      }

      // Add other members
      if (memberIds.length > 0) {
        const memberData = memberIds
          .filter((id: string) => id !== leaderId) // Don't duplicate leader
          .map((userId: string) => ({
            userId,
            teamId: newTeam.id,
            role: 'MEMBER' as const,
            joinedAt: new Date()
          }))

        if (memberData.length > 0) {
          await tx.teamMember.createMany({
            data: memberData
          })
        }
      }

      return newTeam
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId,
        action: 'team_created',
        resource: 'team',
        resourceId: team.id,
        newValues: {
          name: team.name,
          description: team.description,
          workspaceId,
          leaderId,
          memberCount: memberIds.length + (leaderId ? 1 : 0)
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    console.error('Failed to create team:', error)
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    )
  }
}