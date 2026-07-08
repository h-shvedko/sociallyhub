import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { seedClientReports } from '../src/lib/seeders/client-reports-seeder'
import { seedHelpContent } from '../src/lib/seeders/help-content-seeder'
import { seedVideoTutorials } from '../src/lib/seeders/video-tutorial-seeder'
import { seedSupport } from '../src/lib/seeders/support-seeder'
// ADR-0025 D3 minimal-tier seeders (Track B). Relative import (matches this
// file's other seeder imports) so tsx and the esbuild prod bundle both resolve
// them statically — no `@/` alias, no dynamic import (ADR-0025 D5).
import { seedSettingsDefaults } from '../src/lib/seeders/settings-defaults-seeder'
import { seedAdminUser } from '../src/lib/seeders/admin-user-seeder'
// The ONE demo gate (ADR-0025 D1). Relative import for the same tsx/esbuild reason.
import { isDemoMode } from '../src/lib/config/demo'
// Deterministic CI fixtures (ADR-0021). Already exports seedE2E(prisma).
import { seedE2E } from './seed-e2e'

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

// `tag` (e.g. the loop index) is REQUIRED for models with a unique email
// (User): 50 draws from a 50x50 name pool collide ~1-in-3 seed runs (the
// same birthday-problem class as the providerItemId flake fixed earlier) —
// CI run 28878757066 failed on exactly this (duplicate madison.thomas@).
function generateEmail(firstName: string, lastName: string, tag?: number): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.com']
  const plus = tag === undefined ? '' : `+${tag}`
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${plus}@${randomChoice(domains)}`
}

function generateHandle(name: string): string {
  return `@${name.toLowerCase().replace(/\s+/g, '')}${randomInt(100, 9999)}`
}

function extractHashtags(text: string): string[] {
  const hashtags = text.match(/#[\w]+/g) || []
  return hashtags.map(tag => tag.slice(1))
}

// ============================================================================
// TIER: minimal (ADR-0025 D3) — prod-safe, idempotent, NO wipe.
// ============================================================================
// Settings defaults + platform-admin bootstrap only. Runs on every boot
// (including production) and as the first step of the demo and test tiers.
// Delegates to the idempotent Track-B seeders; constructs no data of its own.
export async function seedMinimal(prisma: PrismaClient): Promise<void> {
  console.log('⚙️  [minimal] Seeding settings defaults + platform-admin bootstrap (idempotent)...')
  const settings = await seedSettingsDefaults(prisma)
  const admin = await seedAdminUser(prisma)
  console.log(
    `✅ [minimal] settings → ${settings.configs} config(s), ${settings.flags} flag(s), ` +
    `${settings.templates} template(s); admins → ${admin.admins.length} allowlisted, ${admin.created.length} created`
  )
}

// ============================================================================
// TIER: demo (ADR-0025 D3) — the showcase generator. REQUIRES DEMO_MODE=true.
// ============================================================================
// Runs seedMinimal() first, then generates the ~30k-row demo dataset. The
// destructive deleteMany phase runs ONLY when `opts.wipe` is true; without it
// the generator simply appends (a showcase top-up). demo@sociallyhub.com and
// workspace `demo-workspace` are always preserved.
export async function seedDemo(prisma: PrismaClient, opts?: { wipe?: boolean }): Promise<void> {
  // Hard abort unless the ONE demo gate is on (ADR-0025 D3). A demo dataset must
  // never be generated against a non-demo (e.g. production) environment.
  if (!isDemoMode()) {
    throw new Error('seedDemo requires DEMO_MODE=true (ADR-0025 D3)')
  }

  console.log('🌱 Starting comprehensive demo database seeding...')

  // Clear existing data — ONLY with an explicit --wipe (ADR-0025 D3, the
  // destructive-reset guard). demo@sociallyhub.com and demo-workspace are always
  // preserved so the showcase login and workspace survive a wipe.
  if (opts?.wipe) {
    console.log('🧹 --wipe: clearing existing mock data...')
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
    // Preserve demo@sociallyhub.com (showcase login) AND the 'system' attribution
    // user (id 'system') created by seedMinimal/seedSettingsDefaults — the latter is
    // referenced by settings rows via *_by FKs (ON DELETE RESTRICT), so deleting it
    // throws a foreign-key violation on repeat wipes (ADR-0025 cross-track wiring).
    await prisma.user.deleteMany({
      where: { AND: [{ email: { not: 'demo@sociallyhub.com' } }, { id: { not: 'system' } }] },
    })
  } else {
    console.log('ℹ️  No --wipe: appending demo data (showcase top-up); existing rows preserved.')
  }

  // Minimal tier first (idempotent): settings defaults + platform-admin bootstrap.
  // Runs AFTER the wipe so the admin/settings rows it creates are not deleted.
  await seedMinimal(prisma)

  // Generate Users
  console.log(`👥 Generating ${CONFIG.USERS_COUNT} users...`)
  const users = []

  // Ensure demo user exists
  let demoUser = await prisma.user.findUnique({ where: { email: 'demo@sociallyhub.com' } })
  if (!demoUser) {
    console.log('📧 Creating demo user...')
    // ADR-0025 D4: demo password from DEMO_USER_PASSWORD, else generated and
    // printed ONCE. No committed constant password.
    let demoPasswordPlain = process.env.DEMO_USER_PASSWORD?.trim() || ''
    if (!demoPasswordPlain) {
      demoPasswordPlain = crypto.randomBytes(18).toString('base64url')
      console.log('\n' + '='.repeat(64))
      console.log('⚠️  GENERATED DEMO USER PASSWORD — shown once (set DEMO_USER_PASSWORD to control):')
      console.log(`    demo@sociallyhub.com / ${demoPasswordPlain}`)
      console.log('='.repeat(64) + '\n')
    }
    const hashedPassword = await bcrypt.hash(demoPasswordPlain, 12)
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
    // ADR-0025 D4: per-user random password, NEVER printed — the demo user is
    // the only intended login. No committed constant password.
    const hashedPassword = await bcrypt.hash(crypto.randomBytes(18).toString('base64url'), 12)

    const user = await prisma.user.create({
      data: {
        email: generateEmail(firstName, lastName, i),
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

  // NOTE (ADR-0025): platform-admin grants moved to seedMinimal() via
  // admin-user-seeder (PLATFORM_ADMIN_EMAILS allowlist). The former inline
  // grant block here is removed.

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
          // Loop index embedded → guaranteed unique per (account, i). The old pure
          // randomInt(100000,999999) draw collided ~1-in-25 full seed runs on the
          // @@unique([providerItemId, socialAccountId]) constraint (birthday problem
          // across 25 items/account) and randomly killed CI's seed-smoke (ADR-0021).
          providerItemId: `${account.provider.toLowerCase()}-item-${i}-${randomInt(100000, 999999)}`,
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

  // NOTE (ADR-0025): the inline ADR-0016 settings/feature-flag/backup-config
  // block was removed — those global defaults now live in seedMinimal() via
  // settings-defaults-seeder (Track B), which already ran at the top of this tier.

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

  console.log('🎉 Comprehensive demo database seeding completed!')
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

// ============================================================================
// TIER: test (ADR-0025 D3 / ADR-0021) — deterministic CI fixtures.
// ============================================================================
// Runs seedMinimal() first, then delegates to the deterministic e2e fixture
// seeder (fixed ids/credentials, small volumes) in ./seed-e2e.
export async function seedTest(prisma: PrismaClient): Promise<void> {
  console.log('🧪 [test] Running minimal tier, then deterministic e2e fixtures...')
  await seedMinimal(prisma)
  await seedE2E(prisma)
  console.log('✅ [test] Deterministic fixtures seeded')
}

// ============================================================================
// Dispatcher (ADR-0025 D3): parse the tier, run it, exit loud on failure.
// ============================================================================
async function main() {
  const argv = process.argv.slice(2)
  const tierArg = argv.find((a) => a.startsWith('--tier='))?.split('=')[1]
  const tier = (tierArg || process.env.SEED_TIER || 'minimal').trim()
  const wipe = argv.includes('--wipe')

  const prisma = new PrismaClient()
  console.log(`\n🌱 SociallyHub seed — tier: ${tier}${wipe ? ' (--wipe)' : ''}\n`)
  try {
    switch (tier) {
      case 'minimal':
        await seedMinimal(prisma)
        break
      case 'demo':
        await seedDemo(prisma, { wipe })
        break
      case 'test':
        await seedTest(prisma)
        break
      default:
        throw new Error(`Unknown seed tier "${tier}" (expected: minimal | demo | test)`)
    }
    console.log(`\n✅ Seed complete — tier: ${tier}\n`)
    await prisma.$disconnect()
    process.exit(0)
  } catch (e) {
    console.error(`❌ Seeding failed (tier: ${tier}):`, e)
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

// Run only when executed directly (`tsx prisma/seed.ts` or `node dist/seed.js`),
// never on import (the exported tiers are consumed by e2e/global-setup and CI).
if (require.main === module) {
  // tsx does NOT auto-load .env.local; load it minimally when DATABASE_URL is
  // absent so the documented bare command Just Works (mirrors prisma/seed-e2e.ts).
  if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path')
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]*)["']?\s*$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
      }
    }
  }
  main()
}
