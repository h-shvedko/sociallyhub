import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
// GET /api/admin/support/tickets/[id]/notes - Get all notes for a ticket
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Platform support console: cross-tenant surface (ADR-0004).
    await requirePlatformAdmin()

    const ticketId = params.id

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        workspaceId: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get notes
    const notes = await prisma.supportTicketNote.findMany({
      where: { ticketId },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            department: true,
            user: {
              select: {
                image: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ notes })

  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/support/tickets/[id]/notes - Add internal note to ticket
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Platform support console: cross-tenant surface (ADR-0004).
    const user = await requirePlatformAdmin()
    const userId = user.id

    const ticketId = params.id
    const body = await request.json()

    const {
      content,
      tags = [],
      isInternal = true
    } = body

    // Validation
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        workspaceId: true,
        ticketNumber: true,
        title: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get or create agent record
    let agent = await prisma.supportAgent.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        title: true,
        department: true
      }
    })

    if (!agent) {
      // Create agent record if doesn't exist
      agent = await prisma.supportAgent.create({
        data: {
          userId,
          displayName: user.name || 'Admin',
          title: 'Administrator',
          department: 'admin',
          isActive: true,
          isOnline: true
        },
        select: {
          id: true,
          displayName: true,
          title: true,
          department: true
        }
      })
    }

    // Create note
    const note = await prisma.supportTicketNote.create({
      data: {
        ticketId,
        agentId: agent.id,
        content: content.trim(),
        tags,
        isInternal
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            department: true,
            user: {
              select: {
                image: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ note }, { status: 201 })

  } catch (error) {
    return handleApiError(error)
  }
}
