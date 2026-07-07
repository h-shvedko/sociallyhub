import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedClientReports } from '../src/lib/seeders/client-reports-seeder'
import { seedHelpContent } from '../src/lib/seeders/help-content-seeder'
import { seedVideoTutorials } from '../src/lib/seeders/video-tutorial-seeder'
import { seedSupport } from '../src/lib/seeders/support-seeder'

const prisma = new PrismaClient()

// Configuration for data generation
const CONFIG = {
  USERS_COUNT: 50,
  WORKSPACES_COUNT: 15,
  SOCIAL_ACCOUNTS_PER_WORKSPACE: 8,
  POSTS_PER_WORKSPACE: 100,
  INBOX_ITEMS_PER_ACCOUNT: 25,
  ANALYTICS_METRICS_PER_POST: 15,
  USER_SESSIONS_PER_USER: 20,
  USER_ACTIONS_PER_USER: 100
}

// Mock data arrays for realistic generation
const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William',
  'Charlotte', 'James', 'Amelia', 'Benjamin', 'Mia', 'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander',
  'Abigail', 'Michael', 'Emily', 'Daniel', 'Elizabeth', 'Matthew', 'Sofia', 'Jackson', 'Avery', 'Sebastian',
  'Ella', 'David', 'Madison', 'Carter', 'Scarlett', 'Owen', 'Victoria', 'Wyatt', 'Aria', 'John',
  'Grace', 'Jack', 'Chloe', 'Luke', 'Camila', 'Jayden', 'Penelope', 'Dylan', 'Riley', 'Grayson'
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
]

const COMPANY_NAMES = [
  'TechFlow Solutions', 'Digital Dynamics', 'Innovation Labs', 'Creative Studios', 'Modern Media',
  'NextGen Marketing', 'Bright Ideas Agency', 'Strategic Partners', 'Global Reach', 'Prime Digital',
  'Elite Brands', 'Momentum Marketing', 'Visionary Group', 'Impact Solutions', 'Forward Thinking',
  'Dynamic Designs', 'Creative Collective', 'Smart Strategies', 'Bold Ventures', 'Rising Star Media',
  'Pinnacle Partners', 'Stellar Solutions', 'Quantum Marketing', 'Fusion Creative', 'Apex Agency',
  'Nova Networks', 'Zenith Digital', 'Summit Solutions', 'Peak Performance', 'Matrix Media',
  'Catalyst Creative', 'Prism Partners', 'Velocity Ventures', 'Nexus Networks', 'Phoenix Digital',
  'Orbit Marketing', 'Echo Creative', 'Pulse Partners', 'Spark Solutions', 'Rhythm Media',
  'Wave Digital', 'Flow Creative', 'Shift Solutions', 'Blend Media', 'Core Creative',
  'Edge Marketing', 'Vibe Digital', 'Sync Solutions', 'Buzz Creative', 'Zap Media'
]

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Real Estate',
  'Food & Beverage', 'Travel & Tourism', 'Entertainment', 'Fashion', 'Automotive', 'Sports',
  'Non-profit', 'Legal', 'Consulting', 'Construction', 'Energy', 'Agriculture', 'Telecommunications'
]

const ROLES = ['OWNER', 'ADMIN', 'PUBLISHER', 'ANALYST', 'CLIENT_VIEWER'] as const

const SOCIAL_PROVIDERS = ['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK'] as const

const POST_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as const

const INBOX_SENTIMENTS = ['positive', 'negative', 'neutral'] as const

const INBOX_TYPES = ['COMMENT', 'MENTION', 'DIRECT_MESSAGE', 'REVIEW', 'REPLY'] as const

const INBOX_STATUSES = ['OPEN', 'ASSIGNED', 'SNOOZED', 'CLOSED'] as const

const METRIC_TYPES = [
  'impressions', 'reach', 'engagement', 'likes', 'comments', 'shares', 'clicks', 
  'saves', 'profile_visits', 'website_clicks', 'video_views', 'story_views'
]

const USER_ACTION_TYPES = [
  'login', 'logout', 'create_post', 'schedule_post', 'publish_post', 'edit_post', 'delete_post',
  'create_campaign', 'edit_campaign', 'view_analytics', 'connect_account', 'send_message',
  'create_template', 'upload_asset', 'generate_report', 'invite_user', 'update_settings'
]

const SAMPLE_POSTS = [
  "🚀 Excited to announce our new product launch! What features are you most looking forward to? #Innovation #ProductLaunch",
  "Behind the scenes at our creative studio ✨ Where the magic happens! #BehindTheScenes #Creative",
  "Monday motivation: Success is not the key to happiness. Happiness is the key to success 💪 #MondayMotivation",
  "Just wrapped up an amazing team meeting! Great ideas flowing for Q4 📈 #Teamwork #Growth",
  "Customer spotlight: Amazing feedback from our users this week! 🌟 Thank you for your trust #CustomerLove",
  "Industry insights: The future of digital marketing in 2024 📊 Link in bio for full article #DigitalMarketing",
  "Weekend project completed! Sometimes the best ideas come during downtime 🎨 #Weekend #Creativity",
  "Celebrating our team's hard work this quarter! Pizza party time 🍕 #TeamCelebration #Culture",
  "New blog post is live! 5 Tips for Better Social Media Engagement 📝 #ContentMarketing #Tips",
  "Thank you to everyone who joined our webinar yesterday! 200+ attendees 🎉 #Webinar #Community",
  "Sneak peek at our upcoming campaign 👀 Can you guess what we're working on? #SneakPeek #ComingSoon",
  "Feature Friday: Showcasing our most-used analytics dashboard 📊 #FeatureFriday #Analytics",
  "Throwback to our company retreat last month 🏞️ Building connections outside the office #Retreat #Team",
  "Industry report: Social media trends for 2024 are here! 📈 What trends are you most excited about?",
  "Coffee chat with our CEO ☕ Discussing company vision and future goals #Leadership #Vision"
]

const SAMPLE_COMMENTS = [
  "Great post! Love seeing the behind-the-scenes content 👍",
  "This is exactly what I needed to see today, thank you!",
  "Wow, impressive results! Keep up the great work",
  "Can't wait to try this out! When will it be available?",
  "Amazing team you have there! Culture is everything",
  "Thanks for sharing this insight, very helpful",
  "Love this approach, will definitely implement it",
  "This resonates so much with our experience too",
  "Fantastic work! Looking forward to more updates",
  "Such valuable content, thanks for posting!",
  "This is why I follow your page, quality content!",
  "Inspiring as always! Keep pushing boundaries",
  "Could you share more details about this process?",
  "Brilliant strategy! We should connect sometime",
  "This made my day better, thank you for sharing"
]

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function randomChoices<T>(array: T[], count: number): T[] {
  // Ensure we don't try to pick more items than available
  const actualCount = Math.min(count, array.length)

  // Create a copy of the array and shuffle it
  const shuffled = [...array].sort(() => Math.random() - 0.5)

  // Return the first N unique items
  return shuffled.slice(0, actualCount)
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function randomBoolean(probability = 0.5): boolean {
  return Math.random() < probability
}

function generateEmail(firstName: string, lastName: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.com']
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomChoice(domains)}`
}

function generateHandle(name: string): string {
  return `@${name.toLowerCase().replace(/\s+/g, '')}${randomInt(100, 9999)}`
}

async function main() {
  console.log('🌱 Starting comprehensive database seeding...')

  // Clear existing data
  console.log('🧹 Clearing existing mock data...')
  await prisma.userAction.deleteMany({})
  await prisma.userSession.deleteMany({})
  await prisma.videoUserProgress.deleteMany({})
  await prisma.videoTutorial.deleteMany({})
  await prisma.analyticsMetric.deleteMany({})
  await prisma.conversation.deleteMany({})
  await prisma.inboxItem.deleteMany({})
  await prisma.postVariant.deleteMany({})
  await prisma.post.deleteMany({})
  await prisma.socialAccount.deleteMany({})
  await prisma.userWorkspace.deleteMany({})
  await prisma.client.deleteMany({})
  await prisma.campaign.deleteMany({})
  await prisma.workspace.deleteMany({ where: { id: { not: 'demo-workspace' } } })
  await prisma.user.deleteMany({ where: { email: { not: 'demo@sociallyhub.com' } } })

  // Generate Users
  console.log(`👥 Generating ${CONFIG.USERS_COUNT} users...`)
  const users = []

  // Ensure demo user exists
  let demoUser = await prisma.user.findUnique({ where: { email: 'demo@sociallyhub.com' } })
  if (!demoUser) {
    console.log('📧 Creating demo user...')
    const hashedPassword = await bcrypt.hash('demo123456', 12)
    demoUser = await prisma.user.create({
      data: {
        email: 'demo@sociallyhub.com',
        name: 'Demo User',
        password: hashedPassword,
        emailVerified: new Date(),
        image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
        timezone: 'UTC',
        locale: 'en'
      }
    })
    console.log('✅ Demo user created')
  }
  users.push(demoUser)

  for (let i = 0; i < CONFIG.USERS_COUNT; i++) {
    const firstName = randomChoice(FIRST_NAMES)
    const lastName = randomChoice(LAST_NAMES)
    const hashedPassword = await bcrypt.hash('password123', 12)
    
    const user = await prisma.user.create({
      data: {
        email: generateEmail(firstName, lastName),
        name: `${firstName} ${lastName}`,
        password: hashedPassword,
        emailVerified: randomBoolean(0.8) ? new Date() : null,
        timezone: randomChoice(['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']),
        locale: randomChoice(['en', 'es', 'fr', 'de', 'ja']),
        twoFactorEnabled: randomBoolean(0.2),
        isPlatformAdmin: false, // ADR-0004: mock users NEVER hold platform power
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`
      }
    })
    users.push(user)
  }
  console.log(`✅ Created ${users.length} users`)

  // ADR-0004: grant the platform-admin flag (two-tier authorization model).
  // The demo user is always a platform admin in seeded environments; extra
  // operators come from the PLATFORM_ADMIN_EMAILS comma-separated env
  // allowlist. Idempotent by construction: pure updateMany, safe on every
  // re-seed (the demo user survives re-seeds, so this UPDATES its existing
  // row). All generated mock users above are created with
  // isPlatformAdmin: false and stay false.
  console.log('🛡️ Granting platform admin flags (ADR-0004)...')
  const platformAdminEmails = Array.from(new Set([
    'demo@sociallyhub.com',
    ...(process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ]))
  const platformAdminGrant = await prisma.user.updateMany({
    where: { email: { in: platformAdminEmails } },
    data: { isPlatformAdmin: true }
  })
  console.log(`✅ Platform admin granted to ${platformAdminGrant.count} of ${platformAdminEmails.length} allowlisted email(s): ${platformAdminEmails.join(', ')}`)
  if (platformAdminGrant.count < platformAdminEmails.length) {
    console.warn('⚠️ Some PLATFORM_ADMIN_EMAILS entries matched no user; use scripts/grant-platform-admin.ts after creating those accounts.')
  }

  // Generate Workspaces
  console.log(`🏢 Generating ${CONFIG.WORKSPACES_COUNT} workspaces...`)
  const workspaces = []

  // Ensure demo workspace exists
  let demoWorkspace = await prisma.workspace.findUnique({ where: { id: 'demo-workspace' } })
  if (!demoWorkspace) {
    console.log('🏢 Creating demo workspace...')
    demoWorkspace = await prisma.workspace.create({
      data: {
        id: 'demo-workspace',
        name: 'SociallyHub Demo',
        timezone: 'UTC',
        defaultLocale: 'en',
        supportedLocales: ['en'],
        branding: {
          primaryColor: '#3B82F6',
          logo: 'https://api.dicebear.com/7.x/initials/svg?seed=SociallyHub%20Demo'
        }
      }
    })
    console.log('✅ Demo workspace created')
  }
  workspaces.push(demoWorkspace)

  for (let i = 0; i < CONFIG.WORKSPACES_COUNT; i++) {
    const companyName = randomChoice(COMPANY_NAMES)
    
    const workspace = await prisma.workspace.create({
      data: {
        name: companyName,
        timezone: randomChoice(['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']),
        defaultLocale: randomChoice(['en', 'es', 'fr', 'de']),
        supportedLocales: randomChoices(['en', 'es', 'fr', 'de', 'ja', 'pt'], randomInt(2, 4)),
        branding: {
          primaryColor: randomChoice(['#3B82F6', '#EF4444', '#10B981', '#8B5CF6', '#F59E0B']),
          logo: `https://api.dicebear.com/7.x/initials/svg?seed=${companyName}`
        }
      }
    })
    workspaces.push(workspace)
  }
  console.log(`✅ Created ${workspaces.length} workspaces`)

  // Generate UserWorkspace relationships (Team Members)
  console.log('👥 Creating team member relationships...')
  let teamMemberCount = 0

  // Ensure demo user is owner of demo workspace
  const existingDemoRelation = await prisma.userWorkspace.findUnique({
    where: {
      userId_workspaceId: {
        userId: demoUser.id,
        workspaceId: demoWorkspace.id
      }
    }
  })

  if (!existingDemoRelation) {
    await prisma.userWorkspace.create({
      data: {
        userId: demoUser.id,
        workspaceId: demoWorkspace.id,
        role: 'OWNER'
      }
    })
    teamMemberCount++
    console.log('✅ Demo user added to demo workspace as OWNER')
  }

  for (const workspace of workspaces) {
    const teamSize = randomInt(3, 8) // 3-8 members per workspace
    const workspaceUsers = randomChoices(users, teamSize)
    
    for (let i = 0; i < workspaceUsers.length; i++) {
      const user = workspaceUsers[i]
      const role = i === 0 ? 'OWNER' : randomChoice(ROLES)
      
      // Skip if relationship already exists
      const existing = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspace.id
          }
        }
      })
      
      if (!existing) {
        await prisma.userWorkspace.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: role
          }
        })
        teamMemberCount++
      }
    }
  }
  console.log(`✅ Created ${teamMemberCount} team member relationships`)

  // Generate Social Accounts
  console.log('📱 Generating social accounts...')
  const socialAccounts = []
  
  for (const workspace of workspaces) {
    for (let i = 0; i < CONFIG.SOCIAL_ACCOUNTS_PER_WORKSPACE; i++) {
      const provider = randomChoice(SOCIAL_PROVIDERS)
      const companyHandle = workspace.name.toLowerCase().replace(/\s+/g, '')
      
      const socialAccount = await prisma.socialAccount.create({
        data: {
          workspaceId: workspace.id,
          provider: provider,
          accountType: randomChoice(['profile', 'page', 'channel', 'business']),
          handle: generateHandle(companyHandle),
          displayName: `${workspace.name} ${provider}`,
          accountId: `${provider.toLowerCase()}-${randomInt(100000, 999999)}`,
          accessToken: `encrypted-token-${randomInt(1000000, 9999999)}`,
          refreshToken: randomBoolean(0.7) ? `refresh-token-${randomInt(1000000, 9999999)}` : null,
          tokenExpiry: randomBoolean(0.8) ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
          scopes: randomChoices([
            'read', 'write', 'manage_posts', 'read_insights', 'manage_pages', 
            'publish_video', 'manage_comments', 'read_audience'
          ], randomInt(3, 6)),
          status: randomBoolean(0.9) ? 'ACTIVE' : randomChoice(['TOKEN_EXPIRED', 'REVOKED', 'ERROR']),
          metadata: {
            followerCount: randomInt(100, 100000),
            verifiedAccount: randomBoolean(0.1),
            businessAccount: randomBoolean(0.6)
          }
        }
      })
      socialAccounts.push(socialAccount)
    }
  }
  console.log(`✅ Created ${socialAccounts.length} social accounts`)

  // Mark first task as completed and move to next
  await new Promise(resolve => {
    console.log('✅ Task 1 completed: Users, workspaces, and team members generated')
    resolve(null)
  })

  // Generate Posts and PostVariants
  console.log('📝 Generating posts and variants...')
  const posts = []
  let variantCount = 0

  for (const workspace of workspaces) {
    const workspaceAccounts = socialAccounts.filter(acc => acc.workspaceId === workspace.id)
    const workspaceUsers = await prisma.userWorkspace.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true }
    })
    
    for (let i = 0; i < CONFIG.POSTS_PER_WORKSPACE; i++) {
      const owner = randomChoice(workspaceUsers)
      const postContent = randomChoice(SAMPLE_POSTS)
      const status = randomChoice(POST_STATUSES)
      
      let scheduledAt = null
      let publishedAt = null
      
      if (status === 'SCHEDULED') {
        scheduledAt = randomDate(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      } else if (status === 'PUBLISHED') {
        publishedAt = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())
      }
      
      const post = await prisma.post.create({
        data: {
          workspaceId: workspace.id,
          title: postContent.split('!')[0] + '!',
          baseContent: postContent,
          link: randomBoolean(0.3) ? `https://example.com/article-${randomInt(1, 100)}` : null,
          utmSource: randomBoolean(0.4) ? 'social' : null,
          utmMedium: randomBoolean(0.4) ? randomChoice(['twitter', 'facebook', 'linkedin']) : null,
          utmCampaign: randomBoolean(0.3) ? `campaign-${randomInt(1, 50)}` : null,
          tags: randomChoices(['marketing', 'social', 'business', 'tech', 'growth'], randomInt(1, 3)),
          status: status,
          ownerId: owner.user.id,
          approverId: randomBoolean(0.7) ? randomChoice(workspaceUsers).user.id : null,
          scheduledAt,
          publishedAt
        }
      })
      posts.push(post)

      // Create variants for this post
      const selectedAccounts = randomChoices(workspaceAccounts, randomInt(1, 4))
      for (const account of selectedAccounts) {
        const variantStatus = status === 'PUBLISHED' ? 
          (randomBoolean(0.95) ? 'PUBLISHED' : 'FAILED') : 'PENDING'

        await prisma.postVariant.create({
          data: {
            postId: post.id,
            socialAccountId: account.id,
            text: postContent,
            hashtags: extractHashtags(postContent),
            platformData: {
              customText: `${postContent} - optimized for ${account.provider}`,
              mediaIds: randomBoolean(0.3) ? [`media-${randomInt(1, 100)}`] : []
            },
            status: variantStatus,
            providerPostId: variantStatus === 'PUBLISHED' ? 
              `${account.provider.toLowerCase()}-post-${randomInt(100000, 999999)}` : null,
            publishedAt: variantStatus === 'PUBLISHED' ? publishedAt : null,
            failureReason: variantStatus === 'FAILED' ? 
              randomChoice(['API rate limit', 'Invalid token', 'Content policy violation']) : null
          }
        })
        variantCount++
      }
    }
  }
  console.log(`✅ Created ${posts.length} posts with ${variantCount} variants`)

  // Generate InboxItems and Conversations
  console.log('📥 Generating inbox items and conversations...')
  let inboxItemCount = 0
  let conversationCount = 0

  for (const account of socialAccounts) {
    for (let i = 0; i < CONFIG.INBOX_ITEMS_PER_ACCOUNT; i++) {
      const workspaceUsers = await prisma.userWorkspace.findMany({
        where: { workspaceId: account.workspaceId },
        include: { user: true }
      })

      const inboxItem = await prisma.inboxItem.create({
        data: {
          workspaceId: account.workspaceId,
          socialAccountId: account.id,
          type: randomChoice(INBOX_TYPES),
          providerThreadId: randomBoolean(0.7) ? `thread-${randomInt(100000, 999999)}` : null,
          providerItemId: `${account.provider.toLowerCase()}-item-${randomInt(100000, 999999)}`,
          content: randomChoice(SAMPLE_COMMENTS),
          authorName: `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`,
          authorHandle: generateHandle('user'),
          authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${randomInt(1, 1000)}`,
          sentiment: randomChoice(INBOX_SENTIMENTS),
          status: randomChoice(INBOX_STATUSES),
          assigneeId: randomBoolean(0.6) ? randomChoice(workspaceUsers).user.id : null,
          tags: randomBoolean(0.4) ? randomChoices(['urgent', 'question', 'compliment', 'complaint'], randomInt(1, 2)) : [],
          internalNotes: randomBoolean(0.3) ? 'Internal note about this conversation' : null,
          slaBreachedAt: randomBoolean(0.1) ? randomDate(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()) : null,
          createdAt: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
        }
      })
      inboxItemCount++

      // Create conversation for some inbox items
      if (randomBoolean(0.7)) {
        await prisma.conversation.create({
          data: {
            inboxItemId: inboxItem.id,
            threadData: {
              messages: [
                {
                  id: '1',
                  author: inboxItem.authorName,
                  content: inboxItem.content,
                  timestamp: inboxItem.createdAt.toISOString()
                },
                {
                  id: '2',
                  author: 'Support Team',
                  content: 'Thank you for reaching out! We\'ll get back to you soon.',
                  timestamp: new Date(inboxItem.createdAt.getTime() + 30 * 60 * 1000).toISOString()
                }
              ]
            }
          }
        })
        conversationCount++
      }
    }
  }
  console.log(`✅ Created ${inboxItemCount} inbox items with ${conversationCount} conversations`)

  // Generate AnalyticsMetrics
  console.log('📊 Generating analytics metrics...')
  let metricsCount = 0

  for (const post of posts.filter(p => p.status === 'PUBLISHED')) {
    const workspace = workspaces.find(w => w.id === post.workspaceId)
    const workspaceAccounts = socialAccounts.filter(acc => acc.workspaceId === workspace.id)

    // Create a set to track unique combinations and prevent duplicates
    const usedCombinations = new Set<string>()

    for (let i = 0; i < CONFIG.ANALYTICS_METRICS_PER_POST; i++) {
      let attempts = 0
      let combinationKey = ''
      let account: any, metricType: string, date: Date, hour: number

      // Try to find a unique combination
      do {
        account = randomChoice(workspaceAccounts)
        metricType = randomChoice(METRIC_TYPES)
        date = randomDate(post.publishedAt || new Date(), new Date())
        hour = randomInt(0, 23)

        // Create unique key from constraint fields
        const dateStr = new Date(date.toDateString()).toISOString()
        combinationKey = `${post.ownerId}-${account.id}-${post.id}-${dateStr}-${hour}-${metricType}`
        attempts++
      } while (usedCombinations.has(combinationKey) && attempts < 50)

      // Skip if we couldn't find a unique combination after 50 attempts
      if (usedCombinations.has(combinationKey)) {
        continue
      }

      usedCombinations.add(combinationKey)

      // Generate realistic metric values based on type
      let value = 0
      switch (metricType) {
        case 'impressions':
          value = randomInt(1000, 50000)
          break
        case 'reach':
          value = randomInt(500, 25000)
          break
        case 'engagement':
          value = randomInt(50, 2500)
          break
        case 'likes':
          value = randomInt(20, 1000)
          break
        case 'comments':
          value = randomInt(5, 200)
          break
        case 'shares':
          value = randomInt(2, 100)
          break
        default:
          value = randomInt(10, 1000)
      }

      await prisma.analyticsMetric.create({
        data: {
          workspaceId: workspace.id,
          userId: post.ownerId,
          socialAccountId: account.id,
          postId: post.id,
          date: new Date(date.toDateString()), // Remove time component
          hour,
          platform: account.provider,
          metricType,
          value,
          dimensions: {
            postType: 'organic',
            campaign: post.utmCampaign,
            contentType: randomChoice(['text', 'image', 'video', 'carousel'])
          },
          metadata: {
            deviceType: randomChoice(['mobile', 'desktop', 'tablet']),
            location: randomChoice(['US', 'UK', 'CA', 'AU', 'DE'])
          }
        }
      })
      metricsCount++
    }
  }
  console.log(`✅ Created ${metricsCount} analytics metrics`)

  // Generate UserSessions
  console.log('🖥️ Generating user sessions...')
  let sessionCount = 0

  for (const user of users) {
    for (let i = 0; i < CONFIG.USER_SESSIONS_PER_USER; i++) {
      const startTime = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())
      const duration = randomInt(300, 7200) // 5 minutes to 2 hours
      const endTime = new Date(startTime.getTime() + duration * 1000)

      await prisma.userSession.create({
        data: {
          userId: user.id,
          startTime,
          endTime,
          lastActivity: endTime,
          duration,
          userAgent: randomChoice([
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
          ]),
          ip: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
          pages: randomChoices([
            '/dashboard', '/posts', '/analytics', '/inbox', '/campaigns', 
            '/settings', '/team', '/accounts', '/templates', '/assets'
          ], randomInt(3, 8)),
          metadata: {
            browser: randomChoice(['Chrome', 'Firefox', 'Safari', 'Edge']),
            os: randomChoice(['Windows', 'macOS', 'Linux', 'iOS', 'Android']),
            screenResolution: randomChoice(['1920x1080', '1366x768', '1440x900', '375x667'])
          }
        }
      })
      sessionCount++
    }
  }
  console.log(`✅ Created ${sessionCount} user sessions`)

  // Generate UserActions
  console.log('🎯 Generating user actions...')
  let actionCount = 0

  for (const user of users) {
    for (let i = 0; i < CONFIG.USER_ACTIONS_PER_USER; i++) {
      const actionType = randomChoice(USER_ACTION_TYPES)
      const timestamp = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())

      await prisma.userAction.create({
        data: {
          userId: user.id,
          actionType,
          timestamp,
          details: {
            actionType,
            resourceId: `resource-${randomInt(1, 1000)}`,
            metadata: {
              source: randomChoice(['web', 'mobile', 'api']),
              version: randomChoice(['v1.0', 'v1.1', 'v1.2'])
            }
          },
          duration: randomInt(100, 5000) // milliseconds
        }
      })
      actionCount++
    }
  }
  console.log(`✅ Created ${actionCount} user actions`)

  // Generate Clients
  console.log('👔 Generating clients...')
  const clients = []

  for (const workspace of workspaces) {
    const clientCount = randomInt(3, 8)
    for (let i = 0; i < clientCount; i++) {
      const firstName = randomChoice(FIRST_NAMES)
      const lastName = randomChoice(LAST_NAMES)
      const companyName = randomChoice(COMPANY_NAMES)

      const client = await prisma.client.create({
        data: {
          workspaceId: workspace.id,
          name: `${firstName} ${lastName}`,
          email: generateEmail(firstName, lastName),
          phone: `+1 (${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
          company: companyName,
          industry: randomChoice(INDUSTRIES),
          website: `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          logo: `https://api.dicebear.com/7.x/initials/svg?seed=${companyName}`,
          status: randomChoice(['ACTIVE', 'PROSPECT', 'ON_HOLD']),
          notes: randomBoolean(0.6) ? `Client notes about ${companyName} and their requirements.` : null,
          labels: randomChoices(['VIP', 'Enterprise', 'Startup', 'SMB', 'Non-profit'], randomInt(1, 3)),
          billingInfo: {
            monthlyRetainer: randomInt(500, 10000),
            paymentTerms: randomChoice(['Net 15', 'Net 30', 'Net 45']),
            billingCycle: randomChoice(['monthly', 'quarterly', 'annually'])
          },
          settings: {
            communicationPreference: randomChoice(['email', 'phone', 'slack']),
            reportingFrequency: randomChoice(['weekly', 'monthly', 'quarterly']),
            timezone: randomChoice(['EST', 'PST', 'GMT', 'CET'])
          }
        }
      })
      clients.push(client)
    }
  }
  console.log(`✅ Created ${clients.length} clients`)

  // Generate Campaigns
  console.log('🎯 Generating campaigns...')
  const campaigns = []

  for (const workspace of workspaces) {
    const campaignCount = randomInt(5, 12)
    for (let i = 0; i < campaignCount; i++) {
      const startDate = randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date())
      const endDate = randomDate(startDate, new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000))

      const campaign = await prisma.campaign.create({
        data: {
          workspaceId: workspace.id,
          clientId: randomBoolean(0.7) ? randomChoice(clients.filter(c => c.workspaceId === workspace.id))?.id : null,
          name: `${randomChoice(['Spring', 'Summer', 'Fall', 'Winter'])} ${randomChoice(['Launch', 'Campaign', 'Initiative', 'Drive'])} ${new Date().getFullYear()}`,
          description: `Strategic campaign focused on ${randomChoice(['brand awareness', 'lead generation', 'customer acquisition', 'product launch'])}`,
          status: randomChoice(['ACTIVE', 'PAUSED', 'COMPLETED', 'DRAFT']),
          type: randomChoice(['BRAND_AWARENESS', 'LEAD_GENERATION', 'ENGAGEMENT', 'SALES', 'CUSTOM']),
          startDate,
          endDate,
          objectives: {
            primaryGoal: randomChoice(['reach', 'engagement', 'conversions', 'brand_awareness']),
            targetReach: randomInt(10000, 500000),
            targetEngagement: randomInt(1000, 50000),
            targetConversions: randomInt(100, 5000)
          },
          budget: {
            totalBudget: randomInt(5000, 100000),
            spentAmount: randomInt(0, 50000),
            dailyBudget: randomInt(100, 2000),
            currency: 'USD'
          }
        }
      })
      campaigns.push(campaign)
    }
  }
  console.log(`✅ Created ${campaigns.length} campaigns`)

  // Seed client reports (existing function)
  console.log('📋 Seeding client reports...')
  await seedClientReports()
  console.log('✅ Client reports seeded')

  // Seed help content
  console.log('📚 Seeding help content...')
  await seedHelpContent()
  console.log('✅ Help content seeded')

  // Seed video tutorials
  console.log('🎥 Seeding video tutorials...')
  const videoTutorials = await seedVideoTutorials()
  console.log('✅ Video tutorials seeded')

  // Seed support subsystem (ADR-0011 Phase 3): agents, tickets, timeline, chat
  console.log('🎫 Seeding support data...')
  const supportCounts = await seedSupport()
  console.log('✅ Support data seeded')

  // Seed default settings rows (ADR-0016 Phase 3 item 12 / ADR-0025).
  // Idempotent by hand (findFirst → create): the FeatureFlag @@unique([workspaceId, key])
  // and BackupConfiguration @@unique([workspaceId, name]) are NULLable on workspaceId,
  // and Postgres does not enforce uniqueness across NULLs, so a compound-key upsert
  // is not reliably idempotent for GLOBAL rows — a manual find-or-create is.
  console.log('🚩 Seeding default feature flags + backup configuration...')
  let settingsSeeded = 0

  // Three INERT placeholder feature flags (global scope, workspaceId null). These
  // are NOT live gates — the ADR-0013/0014/0015 deferrals stay on the static env
  // gate (FEATURE_COMMUNITY / FEATURE_DOCS_MANAGEMENT / FEATURE_DISCORD). These rows
  // exist only as a FUTURE migration target so a later ADR can move the deferrals
  // onto the DB-backed flag evaluator without a data-create step.
  const placeholderFlags: Array<{ key: string; name: string; description: string; category: 'FEATURE' }> = [
    {
      key: 'community-subsystem',
      name: 'Community Subsystem',
      description: 'INERT placeholder (ADR-0016). The Community deferral (ADR-0013) stays on the static FEATURE_COMMUNITY env gate; this flag is a future migration target only, not a live gate.',
      category: 'FEATURE',
    },
    {
      key: 'documentation-management',
      name: 'Documentation Management',
      description: 'INERT placeholder (ADR-0016). The Documentation deferral (ADR-0014) stays on the static FEATURE_DOCS_MANAGEMENT env gate; this flag is a future migration target only, not a live gate.',
      category: 'FEATURE',
    },
    {
      key: 'discord-integration',
      name: 'Discord Integration',
      description: 'INERT placeholder (ADR-0016). The Discord deferral (ADR-0015) stays on the static FEATURE_DISCORD env gate; this flag is a future migration target only, not a live gate.',
      category: 'FEATURE',
    },
  ]

  for (const flag of placeholderFlags) {
    const existing = await prisma.featureFlag.findFirst({
      where: { workspaceId: null, key: flag.key },
    })
    if (!existing) {
      await prisma.featureFlag.create({
        data: {
          workspaceId: null,
          key: flag.key,
          name: flag.name,
          description: flag.description,
          category: flag.category,
          isActive: false,
          rolloutPercent: 0,
          createdBy: demoUser.id,
          lastUpdatedBy: demoUser.id,
        },
      })
      settingsSeeded++
    }
  }

  // Default GLOBAL backup configuration — inactive until an admin enables it, so
  // seeding never silently starts writing dumps. Nightly at 02:00 when activated.
  const existingBackupConfig = await prisma.backupConfiguration.findFirst({
    where: { workspaceId: null, name: 'Default database backup' },
  })
  if (!existingBackupConfig) {
    await prisma.backupConfiguration.create({
      data: {
        workspaceId: null,
        name: 'Default database backup',
        backupType: 'DATABASE_ONLY',
        schedule: '0 2 * * *',
        isActive: false,
        retention: 30,
        storageLocation: 'LOCAL',
        storageConfig: {},
        createdBy: demoUser.id,
        lastUpdatedBy: demoUser.id,
      },
    })
    settingsSeeded++
  }

  // NOTE: a baseline system EmailTemplate is intentionally SKIPPED here (ADR-0016
  // Phase 3, optional). The EmailTemplate model carries several required
  // enum/JSON fields (category/type/status + variables) whose correct seeding is
  // non-trivial; a real template belongs to the email-templates admin surface,
  // not to a placeholder seed row.
  console.log(`✅ Seeded ${settingsSeeded} default settings rows (flags + backup config)`)

  // ============================================================================
  // BILLING SUBSCRIPTIONS (ADR-0019 Track A) — idempotent
  // ============================================================================
  // 'demo-workspace' gets BUSINESS/ACTIVE so demo flows are never limit-blocked;
  // every other seeded workspace gets a 14-day PRO trial (matching signup).
  // Stripe is NEVER called from seed (ADR-0025): these are local rows only —
  // the billing webhook owns Stripe-backed state.
  console.log('💳 Seeding billing subscriptions (ADR-0019)...')
  let subscriptionsSeeded = 0
  const allWorkspacesForBilling = await prisma.workspace.findMany({ select: { id: true } })
  for (const ws of allWorkspacesForBilling) {
    const existingSubscription = await prisma.subscription.findFirst({
      where: { workspaceId: ws.id },
    })
    if (existingSubscription) continue
    if (ws.id === 'demo-workspace') {
      await prisma.subscription.create({
        data: {
          workspaceId: ws.id,
          planTier: 'BUSINESS',
          status: 'ACTIVE',
        },
      })
    } else {
      await prisma.subscription.create({
        data: {
          workspaceId: ws.id,
          planTier: 'PRO',
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      })
    }
    subscriptionsSeeded++
  }
  console.log(`✅ Seeded ${subscriptionsSeeded} subscription rows (demo-workspace = BUSINESS/ACTIVE, others = PRO/TRIALING)`)

  console.log('🎉 Comprehensive database seeding completed!')
  console.log(`
📊 Final Statistics:
- Users: ${users.length}
- Workspaces: ${workspaces.length}  
- Team Members: ${teamMemberCount}
- Social Accounts: ${socialAccounts.length}
- Posts: ${posts.length} (with ${variantCount} variants)
- Inbox Items: ${inboxItemCount} (with ${conversationCount} conversations)
- Analytics Metrics: ${metricsCount}
- User Sessions: ${sessionCount}
- User Actions: ${actionCount}
- Clients: ${clients.length}
- Campaigns: ${campaigns.length}
- Video Tutorials: ${videoTutorials.length}
- Support Agents: ${supportCounts.agents}
- Support Tickets: ${supportCounts.tickets} (updates: ${supportCounts.updates}, notes: ${supportCounts.notes}, assignments: ${supportCounts.assignments})
- Support Chats: ${supportCounts.chats} (messages: ${supportCounts.messages})
`)
}

function extractHashtags(text: string): string[] {
  const hashtags = text.match(/#[\w]+/g) || []
  return hashtags.map(tag => tag.slice(1))
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })