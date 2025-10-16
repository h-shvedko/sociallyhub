import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/support/agents/status - Get support team status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const department = searchParams.get('department') || 'support'

    // Get online agents count
    const onlineAgents = await prisma.supportAgent.findMany({
      where: {
        isActive: true,
        isOnline: true,
        department: department
      },
      select: {
        id: true,
        displayName: true,
        title: true,
        statusMessage: true,
        currentChatCount: true,
        maxConcurrentChats: true,
        lastSeen: true,
        user: {
          select: {
            image: true
          }
        }
      },
      orderBy: {
        lastSeen: 'desc'
      }
    })

    // Get total active agents
    const totalActiveAgents = await prisma.supportAgent.count({
      where: {
        isActive: true,
        department: department
      }
    })

    // Calculate availability
    const availableAgents = onlineAgents.filter(agent =>
      agent.currentChatCount < agent.maxConcurrentChats
    )

    // Get current queue size (unassigned chats)
    const queueSize = await prisma.supportChat.count({
      where: {
        status: 'open',
        assignedAgentId: null,
        department: department
      }
    })

    // Calculate average response time (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentChats = await prisma.supportChat.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo
        },
        firstResponseAt: {
          not: null
        },
        department: department
      },
      select: {
        createdAt: true,
        firstResponseAt: true
      }
    })

    let averageResponseTimeMinutes = 0
    if (recentChats.length > 0) {
      const totalResponseTime = recentChats.reduce((acc, chat) => {
        const responseTime = chat.firstResponseAt!.getTime() - chat.createdAt.getTime()
        return acc + responseTime
      }, 0)
      averageResponseTimeMinutes = Math.round(totalResponseTime / recentChats.length / 1000 / 60)
    }

    return NextResponse.json({
      isOnline: availableAgents.length > 0,
      onlineAgents: onlineAgents.length,
      availableAgents: availableAgents.length,
      totalActiveAgents,
      queueSize,
      averageResponseTimeMinutes,
      agents: onlineAgents.map(agent => ({
        id: agent.id,
        displayName: agent.displayName,
        title: agent.title,
        statusMessage: agent.statusMessage,
        availability: agent.currentChatCount < agent.maxConcurrentChats ? 'available' : 'busy',
        image: agent.user?.image,
        lastSeen: agent.lastSeen
      }))
    })
  } catch (error) {
    console.error('Failed to get support team status:', error)
    return NextResponse.json(
      { error: 'Failed to get support team status' },
      { status: 500 }
    )
  }
}