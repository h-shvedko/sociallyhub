import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// GET /api/admin/teams - Get all teams with member information
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

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
    return handleApiError(error)
  }
}

// POST /api/admin/teams - Create new team
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()

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
        userId: user.id,
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
    return handleApiError(error)
  }
}