// Team Members API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Per-member permission storage was removed (role is the sole authz field).
// This static map derives the response's `permissions` object from the member's
// role so existing API consumers keep working.
function derivePermissionsFromRole(role: string) {
  switch (role) {
    case 'OWNER':
      return {
        canManageTeam: true,
        canManageContent: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageBilling: true
      }
    case 'ADMIN':
      return {
        canManageTeam: true,
        canManageContent: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageBilling: false
      }
    case 'PUBLISHER':
      return {
        canManageTeam: false,
        canManageContent: true,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageBilling: false
      }
    case 'ANALYST':
      return {
        canManageTeam: false,
        canManageContent: false,
        canManageSettings: false,
        canViewAnalytics: true,
        canManageBilling: false
      }
    case 'CLIENT_VIEWER':
      return {
        canManageTeam: false,
        canManageContent: false,
        canManageSettings: false,
        canViewAnalytics: true,
        canManageBilling: false
      }
    default:
      return {
        canManageTeam: false,
        canManageContent: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageBilling: false
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      // Authenticate before validation so missing sessions still 401.
      await requireSession()
      return jsonError(400, 'workspaceId is required')
    }

    // Verify user has access to workspace (ADR-0004: any member may list the team)
    await requireWorkspaceRole(workspaceId)

    // Get team members for the workspace
    const teamMembers = await prisma.userWorkspace.findMany({
      where: {
        workspaceId: workspaceId
      },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Get member statistics
    const membersWithStats = await Promise.all(
      teamMembers.map(async (member) => {
        const [assignedInboxItems, resolvedInboxItems, createdPosts, lastActivity] = await Promise.all([
          // Count assigned inbox items
          prisma.inboxItem.count({
            where: {
              workspaceId: workspaceId,
              assigneeId: member.userId,
              status: { in: ['OPEN', 'ASSIGNED', 'SNOOZED'] }
            }
          }),
          
          // Count resolved inbox items
          prisma.inboxItem.count({
            where: {
              workspaceId: workspaceId,
              assigneeId: member.userId,
              status: 'CLOSED'
            }
          }),
          
          // Count created posts
          prisma.post.count({
            where: {
              workspaceId: workspaceId,
              ownerId: member.userId
            }
          }),
          
          // Get last activity (either post creation or inbox item update)
          Promise.all([
            prisma.post.findFirst({
              where: {
                workspaceId: workspaceId,
                ownerId: member.userId
              },
              select: { updatedAt: true },
              orderBy: { updatedAt: 'desc' }
            }),
            prisma.inboxItem.findFirst({
              where: {
                workspaceId: workspaceId,
                assigneeId: member.userId
              },
              select: { updatedAt: true },
              orderBy: { updatedAt: 'desc' }
            })
          ]).then(([lastPost, lastInboxUpdate]) => {
            const postDate = lastPost?.updatedAt
            const inboxDate = lastInboxUpdate?.updatedAt
            
            if (!postDate && !inboxDate) return null
            if (!postDate) return inboxDate
            if (!inboxDate) return postDate
            
            return postDate > inboxDate ? postDate : inboxDate
          })
        ])

        return {
          userId: member.userId,
          role: member.role,
          permissions: derivePermissionsFromRole(member.role), // derived from role; no longer stored per member
          joinedAt: member.createdAt, // Use createdAt as joinedAt for compatibility
          user: member.user,
          stats: {
            assignedInboxItems,
            resolvedInboxItems,
            createdPosts,
            lastActivity,
            responseRate: assignedInboxItems + resolvedInboxItems > 0 
              ? Math.round((resolvedInboxItems / (assignedInboxItems + resolvedInboxItems)) * 100)
              : 0
          }
        }
      })
    )

    // Get pending invitations
    const pendingInvitations = await prisma.teamInvitation.findMany({
      where: {
        workspaceId: workspaceId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        invitedBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate workspace statistics
    const workspaceStats = {
      totalMembers: teamMembers.length,
      pendingInvitations: pendingInvitations.length,
      activeMembers: membersWithStats.filter(member => 
        member.stats.lastActivity && 
        new Date(member.stats.lastActivity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      totalAssignedItems: membersWithStats.reduce((sum, member) => sum + member.stats.assignedInboxItems, 0),
      totalResolvedItems: membersWithStats.reduce((sum, member) => sum + member.stats.resolvedInboxItems, 0),
      averageResponseRate: membersWithStats.length > 0
        ? Math.round(membersWithStats.reduce((sum, member) => sum + member.stats.responseRate, 0) / membersWithStats.length)
        : 0
    }

    return NextResponse.json({
      members: membersWithStats,
      pendingInvitations,
      stats: workspaceStats
    })

  } catch (error) {
    return handleApiError(error)
  }
}