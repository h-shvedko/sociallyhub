import { prisma } from '@/lib/prisma'

/**
 * ADR-0011 Phase 3 (item 13): seed the support subsystem so the admin support
 * pages, the auto-assignment path, and the E2E flows are non-empty on a fresh
 * environment.
 *
 * Seeds into the demo workspace using the REAL Prisma field names (verified
 * against prisma/schema.prisma):
 *   - SupportAgent:  userId, displayName, title, department, isActive, isOnline,
 *                    maxConcurrentChats, currentChatCount, autoAssign, skills,
 *                    languages, statusMessage, lastSeen
 *   - SupportTicket: ticketNumber, workspaceId, userId, title, description,
 *                    category (TicketCategory), priority (TicketPriority),
 *                    status (TicketStatus), type (TicketType), guestName,
 *                    guestEmail, guestPhone, assignedAgentId, assignedAt,
 *                    resolution, resolvedAt, resolvedBy, firstResponseAt,
 *                    expectedResponseBy (the SLA deadline), slaBreached, tags,
 *                    customFields, createdAt
 *   - TicketUpdate:  ticketId, updateType (TicketUpdateType), message,
 *                    oldStatus/newStatus, oldAssignee/newAssignee, authorId,
 *                    authorType, authorName, isPublic, isResolution, createdAt
 *   - SupportTicketNote:       ticketId, agentId, content, isInternal, tags
 *   - SupportTicketAssignment: ticketId, agentId, assignedBy, reason, isActive
 *   - SupportChat:    workspaceId, userId, subject, department, priority, status,
 *                     assignedAgentId, assignedAt, firstResponseAt, category, tags
 *   - SupportMessage: chatId, senderId, senderType, senderName, content,
 *                     messageType, readByUser, readByAgent
 *
 * Note on SupportMessage.senderId: it is a FK to SupportAgent.id. Only "agent"
 * messages may carry a senderId; "user"/"system" messages keep senderId null to
 * respect the constraint.
 *
 * Idempotent: wipes the support tables (child-first) at the start of the step,
 * then reseeds — matching the pattern of the other seeders.
 */
export async function seedSupport() {
  try {
    const demoWorkspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { id: 'demo-workspace' },
          { name: 'Demo Workspace' },
          { name: { contains: 'demo', mode: 'insensitive' } },
        ],
      },
    })

    if (!demoWorkspace) {
      console.log('   ⏭️  Demo workspace not found, skipping support seeding')
      return { agents: 0, tickets: 0, updates: 0, notes: 0, assignments: 0, chats: 0, messages: 0 }
    }

    // Primary requester: the demo user.
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@sociallyhub.com' },
    })
    if (!demoUser) {
      console.log('   ⏭️  Demo user not found, skipping support seeding')
      return { agents: 0, tickets: 0, updates: 0, notes: 0, assignments: 0, chats: 0, messages: 0 }
    }

    // Pick real seeded users: first 3 become agents, next 3 become extra requesters.
    const otherUsers = await prisma.user.findMany({
      where: { email: { not: 'demo@sociallyhub.com' } },
      orderBy: { createdAt: 'asc' },
      take: 6,
    })

    if (otherUsers.length < 3) {
      console.log('   ⏭️  Not enough users to create support agents, skipping support seeding')
      return { agents: 0, tickets: 0, updates: 0, notes: 0, assignments: 0, chats: 0, messages: 0 }
    }

    const agentUsers = otherUsers.slice(0, 3)
    const requesterUsers = otherUsers.slice(3) // 0..3 extra requesters
    const requester = (i: number) =>
      requesterUsers.length > 0 ? requesterUsers[i % requesterUsers.length] : demoUser

    // ---- Idempotency: wipe support tables child-first --------------------
    await prisma.supportMessage.deleteMany({})
    await prisma.supportChat.deleteMany({})
    await prisma.ticketUpdate.deleteMany({})
    await prisma.ticketAttachment.deleteMany({})
    await prisma.supportTicketAssignment.deleteMany({})
    await prisma.supportTicketNote.deleteMany({})
    await prisma.supportContactForm.deleteMany({})
    await prisma.supportTicket.deleteMany({})
    await prisma.supportAgent.deleteMany({})

    // ---- Time helpers ----------------------------------------------------
    const now = Date.now()
    const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000)
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000)
    const minsAgo = (m: number) => new Date(now - m * 60 * 1000)

    // ---- 1) Support agents (mixed departments, one online) ----------------
    const agent0 = await prisma.supportAgent.create({
      data: {
        userId: agentUsers[0].id,
        displayName: agentUsers[0].name ?? 'Support Agent',
        title: 'Senior Support Agent',
        department: 'support',
        isActive: true,
        isOnline: true,
        maxConcurrentChats: 6,
        currentChatCount: 1, // handling the seeded open chat below
        autoAssign: true,
        skills: ['general', 'onboarding', 'billing'],
        languages: ['en'],
        statusMessage: 'Available',
        lastSeen: minsAgo(2),
      },
    })

    const agent1 = await prisma.supportAgent.create({
      data: {
        userId: agentUsers[1].id,
        displayName: agentUsers[1].name ?? 'Technical Specialist',
        title: 'Technical Support Specialist',
        department: 'technical',
        isActive: true,
        isOnline: false,
        maxConcurrentChats: 4,
        currentChatCount: 0,
        autoAssign: true,
        skills: ['technical', 'api', 'integration', 'bug'],
        languages: ['en'],
        statusMessage: null,
        lastSeen: hoursAgo(3),
      },
    })

    const agent2 = await prisma.supportAgent.create({
      data: {
        userId: agentUsers[2].id,
        displayName: agentUsers[2].name ?? 'Sales Agent',
        title: 'Sales & Accounts',
        department: 'sales',
        isActive: true,
        isOnline: false,
        maxConcurrentChats: 5,
        currentChatCount: 0,
        autoAssign: true,
        skills: ['sales', 'billing', 'upgrades'],
        languages: ['en'],
        statusMessage: null,
        lastSeen: hoursAgo(20),
      },
    })

    const agents = [agent0, agent1, agent2]

    // ---- 2) Tickets (~12) spanning statuses/priorities/categories ---------
    let ticketSeq = 20260001

    let ticketCount = 0
    let updateCount = 0
    let noteCount = 0
    let assignmentCount = 0

    // Simple tickets created in one loop; the timeline ticket is handled after.
    const simpleTickets: Array<Parameters<typeof prisma.supportTicket.create>[0]['data']> = [
      // 1) OPEN / GENERAL / LOW — unassigned, demo user
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'How do I connect a second Instagram account?',
        description:
          'I already have one Instagram account linked and would like to add a second business profile to the same workspace. Where do I do that?',
        category: 'GENERAL',
        priority: 'LOW',
        status: 'OPEN',
        type: 'SUPPORT',
        tags: ['instagram', 'accounts'],
        expectedResponseBy: new Date(now + 8 * 60 * 60 * 1000),
        createdAt: hoursAgo(5),
      },
      // 2) OPEN / BILLING / MEDIUM — unassigned, demo user
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Question about my latest invoice',
        description:
          'My invoice this month is higher than usual. Can you break down the charges for me?',
        category: 'BILLING',
        priority: 'MEDIUM',
        status: 'OPEN',
        type: 'BILLING',
        tags: ['billing', 'invoice'],
        expectedResponseBy: new Date(now + 4 * 60 * 60 * 1000),
        createdAt: hoursAgo(9),
      },
      // 3) OPEN / TECHNICAL / URGENT — SLA BREACHED, assigned agent1
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Scheduled posts are not publishing',
        description:
          'None of my posts scheduled for this morning went out. This is affecting a client campaign and needs urgent attention.',
        category: 'TECHNICAL',
        priority: 'URGENT',
        status: 'OPEN',
        type: 'TECHNICAL',
        assignedAgentId: agent1.id,
        assignedAt: hoursAgo(30),
        tags: ['publishing', 'scheduler', 'sla'],
        expectedResponseBy: hoursAgo(6), // deadline already passed
        slaBreached: true,
        createdAt: hoursAgo(31),
      },
      // 4) IN_PROGRESS / BUG_REPORT / HIGH — assigned agent1, first response set
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Analytics dashboard shows blank charts',
        description:
          'Since yesterday the analytics dashboard loads but every chart is empty. Data export still works though.',
        category: 'BUG_REPORT',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        type: 'TECHNICAL',
        assignedAgentId: agent1.id,
        assignedAt: daysAgo(2),
        firstResponseAt: daysAgo(2),
        tags: ['analytics', 'dashboard', 'bug'],
        expectedResponseBy: daysAgo(1),
        createdAt: daysAgo(2),
      },
      // 5) IN_PROGRESS / INTEGRATION / MEDIUM — other requester, agent0
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: requester(0).id,
        title: 'LinkedIn reconnect keeps failing',
        description:
          'When I try to reconnect our LinkedIn page I get redirected back with an error and the account stays in a disconnected state.',
        category: 'INTEGRATION',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        type: 'TECHNICAL',
        assignedAgentId: agent0.id,
        assignedAt: daysAgo(1),
        firstResponseAt: hoursAgo(20),
        tags: ['linkedin', 'oauth', 'integration'],
        expectedResponseBy: new Date(now + 2 * 60 * 60 * 1000),
        createdAt: daysAgo(1),
      },
      // 6) ASSIGNED / FEATURE_REQUEST / LOW — demo user, agent2
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Please add TikTok carousel support',
        description:
          'It would be great if the composer supported multi-image TikTok carousels. Is this on the roadmap?',
        category: 'FEATURE_REQUEST',
        priority: 'LOW',
        status: 'ASSIGNED',
        type: 'SUGGESTION',
        assignedAgentId: agent2.id,
        assignedAt: daysAgo(3),
        tags: ['tiktok', 'feature-request'],
        expectedResponseBy: new Date(now + 24 * 60 * 60 * 1000),
        createdAt: daysAgo(3),
      },
      // 7) PENDING_USER / ACCOUNT / MEDIUM — other requester, agent0
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: requester(1).id,
        title: 'Need to change the workspace owner',
        description:
          'Our previous owner left the company. How do I transfer ownership of the workspace to my account?',
        category: 'ACCOUNT',
        priority: 'MEDIUM',
        status: 'PENDING_USER',
        type: 'SUPPORT',
        assignedAgentId: agent0.id,
        assignedAt: daysAgo(4),
        firstResponseAt: daysAgo(4),
        tags: ['account', 'ownership'],
        expectedResponseBy: daysAgo(3),
        createdAt: daysAgo(4),
      },
      // 8) RESOLVED / ACCOUNT / LOW — demo user, agent0 (simple resolution)
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Reset my two-factor authentication',
        description:
          'I lost my phone and can no longer generate 2FA codes. Please help me reset two-factor on my account.',
        category: 'ACCOUNT',
        priority: 'LOW',
        status: 'RESOLVED',
        type: 'SUPPORT',
        assignedAgentId: agent0.id,
        assignedAt: daysAgo(6),
        firstResponseAt: daysAgo(6),
        resolution:
          'Verified identity and cleared the stale 2FA secret. The user re-enrolled a new authenticator successfully.',
        resolvedAt: daysAgo(5),
        resolvedBy: agent0.id,
        tags: ['account', '2fa', 'security'],
        expectedResponseBy: daysAgo(5),
        createdAt: daysAgo(6),
      },
      // 9) CLOSED / GENERAL / LOW — other requester, agent0 (compliment)
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: requester(2).id,
        title: 'Thanks for the quick help!',
        description:
          'Just wanted to say the onboarding call was really helpful and everything is working now.',
        category: 'GENERAL',
        priority: 'LOW',
        status: 'CLOSED',
        type: 'COMPLIMENT',
        assignedAgentId: agent0.id,
        assignedAt: daysAgo(10),
        firstResponseAt: daysAgo(10),
        resolution: 'Thanked the customer and closed the ticket.',
        resolvedAt: daysAgo(9),
        resolvedBy: agent0.id,
        tags: ['feedback'],
        expectedResponseBy: daysAgo(9),
        createdAt: daysAgo(10),
      },
      // 10) GUEST ticket — OPEN / API / HIGH — no userId, guest contact set
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: null,
        userId: null,
        title: 'API rate limits before purchasing',
        description:
          'I am evaluating SociallyHub for a high-volume use case. What are the API rate limits on the Pro plan?',
        category: 'API',
        priority: 'HIGH',
        status: 'OPEN',
        type: 'SALES',
        guestName: 'Jordan Prospect',
        guestEmail: 'jordan.prospect@example.com',
        guestPhone: '+1-555-0142',
        tags: ['api', 'pre-sales', 'guest'],
        expectedResponseBy: new Date(now + 3 * 60 * 60 * 1000),
        createdAt: hoursAgo(3),
      },
      // 11) IN_PROGRESS / SECURITY / CRITICAL — demo user, agent1
      {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Suspicious login on my account',
        description:
          'I received an email about a login from a country I have never visited. Can you check my account activity and secure it?',
        category: 'SECURITY',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        type: 'SUPPORT',
        assignedAgentId: agent1.id,
        assignedAt: hoursAgo(2),
        firstResponseAt: hoursAgo(1),
        tags: ['security', 'account', 'urgent'],
        expectedResponseBy: new Date(now + 1 * 60 * 60 * 1000),
        createdAt: hoursAgo(2),
      },
    ]

    for (const data of simpleTickets) {
      await prisma.supportTicket.create({ data })
      ticketCount++
    }

    // ---- 12) RESOLVED ticket WITH a full TicketUpdate timeline ------------
    const timelineTicket = await prisma.supportTicket.create({
      data: {
        ticketNumber: `TICK-${ticketSeq++}`,
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        title: 'Bulk CSV import fails for large files',
        description:
          'When I import a CSV of 2,000+ scheduled posts the upload spins and then errors out. Smaller files under 500 rows import fine.',
        category: 'TECHNICAL',
        priority: 'HIGH',
        status: 'RESOLVED',
        type: 'TECHNICAL',
        assignedAgentId: agent1.id,
        assignedAt: daysAgo(7),
        firstResponseAt: daysAgo(7),
        resolution:
          'Root cause was a request timeout on very large imports. Raised the streaming import batch limit and confirmed a 2,500-row file imports successfully.',
        resolvedAt: daysAgo(6),
        resolvedBy: agent1.id,
        tags: ['csv', 'import', 'performance', 'bug'],
        customFields: { affectedRows: 2000, plan: 'pro' },
        expectedResponseBy: daysAgo(6),
        createdAt: daysAgo(8),
      },
    })
    ticketCount++

    // Timeline updates (createdAt spaced across the ticket lifecycle).
    const timeline = [
      {
        ticketId: timelineTicket.id,
        updateType: 'ASSIGNMENT_CHANGE' as const,
        message: 'Auto-assigned to the technical queue (least-loaded online agent).',
        newAssignee: agent1.id,
        authorId: null,
        authorType: 'system',
        authorName: 'SociallyHub',
        isPublic: false,
        createdAt: daysAgo(8),
      },
      {
        ticketId: timelineTicket.id,
        updateType: 'USER_REPLY' as const,
        message:
          'Attaching the CSV that fails. It has about 2,300 rows. The smaller sample of 400 rows worked fine.',
        authorId: demoUser.id,
        authorType: 'user',
        authorName: demoUser.name ?? 'Demo User',
        isPublic: true,
        createdAt: daysAgo(7),
      },
      {
        ticketId: timelineTicket.id,
        updateType: 'AGENT_REPLY' as const,
        message:
          'Thanks for the file — reproduced the failure on our side. It looks like the import times out on large batches. Investigating a fix now.',
        oldStatus: 'ASSIGNED' as const,
        newStatus: 'IN_PROGRESS' as const,
        authorId: agent1.id,
        authorType: 'agent',
        authorName: agent1.displayName,
        isPublic: true,
        createdAt: hoursAgo(7 * 24 - 2),
      },
      {
        // Internal note — NOT visible to the requester (isPublic: false).
        ticketId: timelineTicket.id,
        updateType: 'INTERNAL_NOTE' as const,
        message:
          'Confirmed 30s gateway timeout on imports >1,500 rows. Bumping IMPORT_BATCH_LIMIT and switching to streaming parse. Ticket for eng filed internally.',
        authorId: agent1.id,
        authorType: 'agent',
        authorName: agent1.displayName,
        isPublic: false,
        createdAt: daysAgo(6),
      },
      {
        ticketId: timelineTicket.id,
        updateType: 'RESOLUTION' as const,
        message:
          'Deployed the fix and validated a 2,500-row import end to end. Please re-run your import and let us know if anything else comes up.',
        oldStatus: 'IN_PROGRESS' as const,
        newStatus: 'RESOLVED' as const,
        authorId: agent1.id,
        authorType: 'agent',
        authorName: agent1.displayName,
        isPublic: true,
        isResolution: true,
        createdAt: daysAgo(6),
      },
    ]

    for (const update of timeline) {
      await prisma.ticketUpdate.create({ data: update })
      updateCount++
    }

    // Assignment history row for the timeline ticket.
    await prisma.supportTicketAssignment.create({
      data: {
        ticketId: timelineTicket.id,
        agentId: agent1.id,
        assignedBy: null,
        reason: 'Auto-assigned to least-loaded online technical agent',
        isActive: true,
        assignedAt: daysAgo(8),
      },
    })
    assignmentCount++

    // Internal agent note (SupportTicketNote) for the timeline ticket.
    await prisma.supportTicketNote.create({
      data: {
        ticketId: timelineTicket.id,
        agentId: agent1.id,
        content:
          'Customer is on the Pro plan and imports weekly — flagging as a recurring large-import user for the eng follow-up.',
        isInternal: true,
        tags: ['eng-followup', 'large-import'],
        createdAt: daysAgo(6),
      },
    })
    noteCount++

    // ---- 3) One open SupportChat with a few messages ----------------------
    const chat = await prisma.supportChat.create({
      data: {
        workspaceId: demoWorkspace.id,
        userId: demoUser.id,
        subject: 'Help setting up post approvals',
        department: 'support',
        priority: 'medium',
        status: 'assigned',
        category: 'general',
        assignedAgentId: agent0.id,
        assignedAt: minsAgo(9),
        firstResponseAt: minsAgo(7),
        tags: ['approvals', 'onboarding'],
      },
    })

    const chatMessages = [
      {
        chatId: chat.id,
        senderId: null, // system message — no agent FK
        senderType: 'system',
        senderName: 'SociallyHub Support',
        content: 'Hi! You are connected to SociallyHub support. How can we help today?',
        messageType: 'system',
        readByUser: true,
        readByAgent: true,
        createdAt: minsAgo(10),
      },
      {
        chatId: chat.id,
        senderId: null, // user message — senderId is a SupportAgent FK, so keep null
        senderType: 'user',
        senderName: demoUser.name ?? 'Demo User',
        content:
          'Hi, I want to require approval before scheduled posts go live. Where do I turn that on?',
        messageType: 'text',
        readByUser: true,
        readByAgent: true,
        createdAt: minsAgo(9),
      },
      {
        chatId: chat.id,
        senderId: agent0.id, // agent message — valid SupportAgent FK
        senderType: 'agent',
        senderName: agent0.displayName,
        content:
          'Happy to help! You can enable approvals under Settings → Workspace → Publishing. Turn on "Require approval" and choose who can approve. Want me to walk you through it?',
        messageType: 'text',
        readByUser: true,
        readByAgent: true,
        createdAt: minsAgo(7),
      },
    ]

    for (const message of chatMessages) {
      await prisma.supportMessage.create({ data: message })
    }

    const counts = {
      agents: agents.length,
      tickets: ticketCount,
      updates: updateCount,
      notes: noteCount,
      assignments: assignmentCount,
      chats: 1,
      messages: chatMessages.length,
    }

    console.log(
      `   🎫 Support seeded: ${counts.agents} agents, ${counts.tickets} tickets ` +
        `(1 SLA-breached, 1 guest, 1 resolved-with-timeline), ${counts.updates} updates, ` +
        `${counts.notes} internal note, ${counts.assignments} assignment, ` +
        `${counts.chats} chat / ${counts.messages} messages`,
    )

    return counts
  } catch (error) {
    console.error('❌ Error seeding support data:', error)
    return { agents: 0, tickets: 0, updates: 0, notes: 0, assignments: 0, chats: 0, messages: 0 }
  }
}
