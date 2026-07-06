import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/notifications/email-service'
import { notifyUser } from '@/lib/notifications/notify'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Branded HTML for the "an agent replied to your ticket" notification email.
function buildAgentReplyEmailHtml(params: {
  recipientName: string
  ticketNumber: string
  ticketTitle: string
  agentName: string
  message: string
  isResolution: boolean
}): string {
  const { recipientName, ticketNumber, ticketTitle, agentName, message, isResolution } = params
  const messageHtml = escapeHtml(message).replace(/\n/g, '<br>')
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #2563eb; padding: 16px; border-radius: 12px;">
          <span style="color: white; font-size: 24px; font-weight: bold;">S</span>
        </div>
      </div>
      <h1 style="color: #2563eb;">${isResolution ? 'Your ticket has been resolved' : 'We replied to your support ticket'}</h1>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p><strong>${escapeHtml(agentName)}</strong> replied to your support ticket
        <strong>${escapeHtml(ticketNumber)}</strong> — "${escapeHtml(ticketTitle)}".</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        ${messageHtml}
      </div>
      ${
        isResolution
          ? '<p>This ticket has been marked as <strong>resolved</strong>. If you still need help, just reply and we\'ll reopen it.</p>'
          : '<p>You can reply directly to this email or from your SociallyHub support dashboard.</p>'
      }
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #64748b; font-size: 14px;">Best regards,<br>The SociallyHub Support Team</p>
    </div>
  `
}

// POST /api/admin/support/tickets/[id]/reply - Add response to ticket
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Platform support console: cross-tenant surface (ADR-0004).
    const user = await requirePlatformAdmin()
    const userId = user.id

    const ticketId = params.id
    const body = await request.json()

    const {
      message,
      isPublic = true,
      isResolution = false,
      updateStatus,
      updatePriority
    } = body

    // Validation
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNumber: true,
        userId: true,
        workspaceId: true,
        status: true,
        priority: true,
        firstResponseAt: true,
        title: true,
        user: {
          select: {
            email: true,
            name: true
          }
        },
        guestEmail: true,
        guestName: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get agent info
    const agent = await prisma.supportAgent.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        title: true,
        department: true
      }
    })

    // Prepare ticket updates
    const ticketUpdateData: any = {}
    const changes: string[] = []

    // Mark first response time if this is the first agent response
    if (!ticket.firstResponseAt) {
      ticketUpdateData.firstResponseAt = new Date()
      changes.push('First response recorded')
    }

    // Update status if provided
    if (updateStatus && updateStatus !== ticket.status) {
      ticketUpdateData.status = updateStatus
      changes.push(`Status changed to ${updateStatus}`)

      if (updateStatus === 'RESOLVED' || updateStatus === 'CLOSED') {
        ticketUpdateData.resolvedAt = new Date()
        ticketUpdateData.resolvedBy = userId
      }
    }

    // Update priority if provided
    if (updatePriority && updatePriority !== ticket.priority) {
      ticketUpdateData.priority = updatePriority
      changes.push(`Priority changed to ${updatePriority}`)
    }

    // If marked as resolution, add resolution to ticket
    if (isResolution) {
      ticketUpdateData.resolution = message.trim()
      if (!updateStatus) {
        ticketUpdateData.status = 'RESOLVED'
        ticketUpdateData.resolvedAt = new Date()
        ticketUpdateData.resolvedBy = userId
        changes.push('Ticket resolved')
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update ticket if needed
      let updatedTicket = ticket
      if (Object.keys(ticketUpdateData).length > 0) {
        updatedTicket = await tx.supportTicket.update({
          where: { id: ticketId },
          data: ticketUpdateData,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            assignedAgent: {
              select: {
                id: true,
                displayName: true,
                title: true,
                department: true
              }
            }
          }
        })
      }

      // Create ticket update record
      const ticketUpdate = await tx.ticketUpdate.create({
        data: {
          ticketId: ticketId,
          updateType: isResolution ? 'RESOLUTION' : 'AGENT_REPLY',
          message: message.trim(),
          oldStatus: updateStatus ? ticket.status : undefined,
          newStatus: updateStatus || undefined,
          oldPriority: updatePriority ? ticket.priority : undefined,
          newPriority: updatePriority || undefined,
          authorId: userId,
          authorType: 'agent',
          authorName: agent?.displayName || user.name || 'Agent',
          isPublic,
          isResolution
        },
        include: {
          ticket: {
            select: {
              ticketNumber: true,
              title: true
            }
          }
        }
      })

      return { updatedTicket, ticketUpdate }
    })

    // Notify the requester of the public reply (ADR-0011 Phase 1, item 7a).
    // Internal (isPublic:false) replies stay agent-side and never notify the user.
    if (isPublic) {
      const recipientEmail = ticket.user?.email || ticket.guestEmail
      const recipientName = ticket.user?.name || ticket.guestName || 'there'
      const ticketNumber = ticket.ticketNumber
      const agentName = agent?.displayName || user.name || 'Support'

      // Real transactional email to the requester (user OR guest). Best-effort:
      // the reply is already committed, so an SMTP failure is logged loudly (per
      // ADR-0011 risk note) but does not fail the agent's request.
      if (recipientEmail) {
        try {
          await emailService.send({
            to: [recipientEmail],
            subject: `Re: [${ticketNumber}] ${ticket.title}`,
            html: buildAgentReplyEmailHtml({
              recipientName,
              ticketNumber,
              ticketTitle: ticket.title,
              agentName,
              message: message.trim(),
              isResolution,
            }),
            text:
              `Hi ${recipientName},\n\n` +
              `${agentName} replied to your support ticket ${ticketNumber} "${ticket.title}":\n\n` +
              `${message.trim()}\n\n` +
              (isResolution
                ? 'This ticket has been marked as resolved. Reply if you still need help.\n\n'
                : 'You can reply to this email or from your SociallyHub support dashboard.\n\n') +
              'The SociallyHub Support Team',
          })
        } catch (emailError) {
          console.error(
            `[support-reply] Failed to email requester ${recipientEmail} for ticket ${ticketNumber}:`,
            emailError instanceof Error ? emailError.message : emailError
          )
        }
      }

      // In-app notification for registered users (guests have no account).
      if (ticket.userId) {
        try {
          await notifyUser(ticket.userId, {
            type: 'SUPPORT_TICKET_UPDATED',
            title: isResolution
              ? `Ticket ${ticketNumber} resolved`
              : `New reply on ticket ${ticketNumber}`,
            message: `${agentName} replied to your support ticket "${ticket.title}".`,
            data: {
              ticketId,
              ticketNumber,
              actionUrl: `/dashboard/support/tickets/${ticketId}`,
            },
          })
        } catch (notifyError) {
          console.error(
            `[support-reply] Failed to create in-app notification for user ${ticket.userId} on ticket ${ticketNumber}:`,
            notifyError instanceof Error ? notifyError.message : notifyError
          )
        }
      }
    }

    return NextResponse.json({
      ticketUpdate: result.ticketUpdate,
      ticket: result.updatedTicket,
      changes: changes.length
    }, { status: 201 })

  } catch (error) {
    return handleApiError(error)
  }
}