import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const supportAgents = [
  {
    email: 'sarah.support@sociallyhub.com',
    name: 'Sarah Johnson',
    displayName: 'Sarah',
    title: 'Senior Support Agent',
    department: 'support',
    skills: ['general', 'billing', 'account'],
    isOnline: true,
    statusMessage: 'Happy to help!'
  },
  {
    email: 'mike.tech@sociallyhub.com',
    name: 'Mike Chen',
    displayName: 'Mike',
    title: 'Technical Specialist',
    department: 'technical',
    skills: ['technical', 'api', 'integrations'],
    isOnline: true,
    statusMessage: 'API expert ready to assist'
  },
  {
    email: 'emma.sales@sociallyhub.com',
    name: 'Emma Rodriguez',
    displayName: 'Emma',
    title: 'Sales Specialist',
    department: 'sales',
    skills: ['sales', 'pricing', 'features'],
    isOnline: false,
    statusMessage: null
  },
  {
    email: 'alex.support@sociallyhub.com',
    name: 'Alex Thompson',
    displayName: 'Alex',
    title: 'Support Agent',
    department: 'support',
    skills: ['general', 'onboarding'],
    isOnline: true,
    statusMessage: 'Here to help with your questions'
  },
  {
    email: 'lisa.billing@sociallyhub.com',
    name: 'Lisa Wang',
    displayName: 'Lisa',
    title: 'Billing Specialist',
    department: 'billing',
    skills: ['billing', 'payments', 'subscriptions'],
    isOnline: false,
    statusMessage: null
  }
]

async function seedSupportAgents() {
  console.log('Seeding support agents...')

  try {
    // Create users and agents
    for (const agentData of supportAgents) {
      const { email, name, displayName, title, department, skills, isOnline, statusMessage } = agentData

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        // Create user for the agent
        const hashedPassword = await bcrypt.hash('support123!', 12)
        user = await prisma.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
            emailVerified: new Date(),
            timezone: 'UTC',
            locale: 'en'
          }
        })
        console.log(`✓ Created user: ${name}`)
      }

      // Check if support agent already exists
      const existingAgent = await prisma.supportAgent.findUnique({
        where: { userId: user.id }
      })

      if (!existingAgent) {
        await prisma.supportAgent.create({
          data: {
            userId: user.id,
            displayName,
            title,
            department,
            skills,
            isOnline,
            statusMessage,
            maxConcurrentChats: 5,
            currentChatCount: 0,
            autoAssign: true,
            languages: ['en'],
            timezone: 'UTC',
            lastSeen: isOnline ? new Date() : new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago if offline
          }
        })
        console.log(`✓ Created support agent: ${displayName}`)
      } else {
        // Update existing agent
        await prisma.supportAgent.update({
          where: { userId: user.id },
          data: {
            displayName,
            title,
            department,
            skills,
            isOnline,
            statusMessage,
            lastSeen: isOnline ? new Date() : existingAgent.lastSeen
          }
        })
        console.log(`✓ Updated support agent: ${displayName}`)
      }
    }

    // Create some sample chat data for demonstration
    console.log('Creating sample chat data...')

    // Get an online agent
    const onlineAgent = await prisma.supportAgent.findFirst({
      where: { isOnline: true },
      include: { user: true }
    })

    if (onlineAgent) {
      // Create a sample resolved chat
      const sampleChat = await prisma.supportChat.create({
        data: {
          guestName: 'John Doe',
          guestEmail: 'john.doe@example.com',
          subject: 'Help with API integration',
          department: 'technical',
          priority: 'medium',
          status: 'resolved',
          assignedAgentId: onlineAgent.id,
          assignedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          firstResponseAt: new Date(Date.now() - 55 * 60 * 1000), // 55 minutes ago
          resolvedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          rating: 5,
          feedback: 'Great help! Very knowledgeable and quick response.',
          sessionId: 'demo_session_123',
          userAgent: 'Mozilla/5.0 (Demo Browser)',
          ipAddress: '192.168.1.100'
        }
      })

      // Create sample messages for the chat
      await prisma.supportMessage.createMany({
        data: [
          {
            chatId: sampleChat.id,
            senderType: 'user',
            senderName: 'John Doe',
            content: 'Hi, I\'m having trouble with the API integration. The authentication endpoint is returning a 401 error.',
            messageType: 'text',
            readByUser: true,
            readByAgent: true,
            createdAt: new Date(Date.now() - 60 * 60 * 1000)
          },
          {
            chatId: sampleChat.id,
            senderId: onlineAgent.id,
            senderType: 'agent',
            senderName: onlineAgent.displayName,
            content: `Hello John! I'm ${onlineAgent.displayName} and I'll help you with the API integration. A 401 error usually means there's an issue with your API key or the authentication headers. Can you check if you're including the Bearer token in your Authorization header?`,
            messageType: 'text',
            readByUser: true,
            readByAgent: true,
            createdAt: new Date(Date.now() - 55 * 60 * 1000)
          },
          {
            chatId: sampleChat.id,
            senderType: 'user',
            senderName: 'John Doe',
            content: 'Oh, I think I was missing the "Bearer " prefix! Let me try that.',
            messageType: 'text',
            readByUser: true,
            readByAgent: true,
            createdAt: new Date(Date.now() - 50 * 60 * 1000)
          },
          {
            chatId: sampleChat.id,
            senderId: onlineAgent.id,
            senderType: 'agent',
            senderName: onlineAgent.displayName,
            content: 'Perfect! That\'s a common issue. The header should look like: `Authorization: Bearer YOUR_API_KEY`. Let me know if that fixes it!',
            messageType: 'text',
            readByUser: true,
            readByAgent: true,
            createdAt: new Date(Date.now() - 45 * 60 * 1000)
          },
          {
            chatId: sampleChat.id,
            senderType: 'user',
            senderName: 'John Doe',
            content: 'That worked perfectly! Thank you so much for the quick help.',
            messageType: 'text',
            readByUser: true,
            readByAgent: true,
            createdAt: new Date(Date.now() - 15 * 60 * 1000)
          },
          {
            chatId: sampleChat.id,
            senderId: onlineAgent.id,
            senderType: 'agent',
            senderName: onlineAgent.displayName,
            content: 'You\'re welcome! I\'m glad I could help. Feel free to reach out if you have any other questions about the API. Have a great day!',
            messageType: 'text',
            readByUser: true,
            readByAgent: true,
            createdAt: new Date(Date.now() - 10 * 60 * 1000)
          }
        ]
      })

      console.log('✓ Created sample chat conversation')
    }

    console.log('✅ Support agents seeding completed successfully!')

  } catch (error) {
    console.error('❌ Error seeding support agents:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed function
seedSupportAgents()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })