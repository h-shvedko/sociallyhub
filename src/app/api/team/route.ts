// Team Members API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No access to workspace' }, { status: 403 })
    }

    // Get team members for the workspace
    const teamMembers = await prisma.userWorkspace.findMany({
      where: {
        workspaceId: workspaceId
      },
      select: {
        userId: true,
        role: true,
        joinedAt: true,
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
        { joinedAt: 'asc' }
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
          joinedAt: member.joinedAt,
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

    // Calculate workspace statistics
    const workspaceStats = {
      totalMembers: teamMembers.length,
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
      stats: workspaceStats
    })

  } catch (error) {
    console.error('Team API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch team members',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}