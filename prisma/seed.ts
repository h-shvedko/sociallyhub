import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123456', 12)
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@sociallyhub.com' },
    update: {
      password: hashedPassword, // Always update password to ensure it's properly hashed
      name: 'Demo User',
    },
    create: {
      email: 'demo@sociallyhub.com',
      name: 'Demo User',
      password: hashedPassword,
    },
  })

  console.log('✅ Created demo user:', demoUser.email)

  // Create demo workspace
  const demoWorkspace = await prisma.workspace.upsert({
    where: { id: 'demo-workspace' },
    update: {},
    create: {
      id: 'demo-workspace',
      name: 'Demo Workspace',
      timezone: 'UTC',
    },
  })

  console.log('✅ Created demo workspace:', demoWorkspace.name)

  // Connect user to workspace
  await prisma.userWorkspace.upsert({
    where: {
      userId_workspaceId: {
        userId: demoUser.id,
        workspaceId: demoWorkspace.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      workspaceId: demoWorkspace.id,
      role: 'OWNER',
      permissions: {
        canPost: true,
        canSchedule: true,
        canManageTeam: true,
      },
    },
  })

  console.log('✅ Connected user to workspace')

  // Create demo social accounts
  const socialAccounts = [
    {
      id: 'twitter-demo',
      provider: 'TWITTER',
      accountType: 'profile',
      handle: '@demobrand',
      displayName: 'Demo Brand',
      accountId: 'twitter-123456789',
      accessToken: 'demo-access-token-encrypted',
      scopes: ['tweet.read', 'tweet.write', 'users.read'],
      status: 'ACTIVE',
    },
    {
      id: 'facebook-demo',
      provider: 'FACEBOOK',
      accountType: 'page',
      handle: 'Demo Brand',
      displayName: 'Demo Brand Facebook',
      accountId: 'facebook-987654321',
      accessToken: 'demo-fb-access-token-encrypted',
      scopes: ['pages_manage_posts', 'pages_read_engagement'],
      status: 'ACTIVE',
    },
    {
      id: 'instagram-demo',
      provider: 'INSTAGRAM',
      accountType: 'business',
      handle: '@demobrand',
      displayName: 'Demo Brand Instagram',
      accountId: 'instagram-456789123',
      accessToken: 'demo-ig-access-token-encrypted',
      scopes: ['instagram_basic', 'instagram_content_publish'],
      status: 'ACTIVE',
    },
    {
      id: 'linkedin-demo',
      provider: 'LINKEDIN',
      accountType: 'company',
      handle: 'Demo Brand',
      displayName: 'Demo Brand LinkedIn',
      accountId: 'linkedin-321654987',
      accessToken: 'demo-li-access-token-encrypted',
      scopes: ['w_member_social', 'r_organization_social'],
      status: 'ACTIVE',
    },
    {
      id: 'youtube-demo',
      provider: 'YOUTUBE',
      accountType: 'channel',
      handle: 'Demo Brand',
      displayName: 'Demo Brand YouTube',
      accountId: 'youtube-789123456',
      accessToken: 'demo-yt-access-token-encrypted',
      scopes: ['youtube.upload', 'youtube.readonly'],
      status: 'ACTIVE',
    },
    {
      id: 'tiktok-demo',
      provider: 'TIKTOK',
      accountType: 'profile',
      handle: '@demobrand',
      displayName: 'Demo Brand TikTok',
      accountId: 'tiktok-654321789',
      accessToken: 'demo-tk-access-token-encrypted',
      scopes: ['video.upload', 'user.info.basic'],
      status: 'ACTIVE',
    },
  ]

  for (const accountData of socialAccounts) {
    const account = await prisma.socialAccount.upsert({
      where: { id: accountData.id },
      update: {},
      create: {
        ...accountData,
        workspaceId: demoWorkspace.id,
        provider: accountData.provider as any,
        status: accountData.status as any,
      },
    })
    console.log(`✅ Created ${accountData.provider} account:`, account.displayName)
  }

  // Create some demo posts
  const demoPosts = [
    {
      title: '🚀 Welcome to SociallyHub!',
      baseContent: '🚀 Welcome to SociallyHub! We\'re excited to help you manage your social media presence across all platforms. #SociallyHub #SocialMedia #Management',
      status: 'PUBLISHED',
      platforms: ['TWITTER', 'FACEBOOK', 'LINKEDIN'],
      publishedAt: new Date('2024-08-25T10:00:00Z'),
    },
    {
      title: '📊 Analytics Dashboard Demo',
      baseContent: '📊 Check out our new analytics dashboard! Get insights into your social media performance with beautiful charts and actionable data. #Analytics #Dashboard #Insights',
      status: 'SCHEDULED',
      platforms: ['TWITTER', 'LINKEDIN'],
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    },
    {
      title: '✨ Feature Update Draft',
      baseContent: '✨ We\'re working on some amazing new features! Stay tuned for updates on our multi-platform scheduling system. #ComingSoon #Updates',
      status: 'DRAFT',
      platforms: ['TWITTER', 'FACEBOOK', 'INSTAGRAM'],
    },
  ]

  for (const postData of demoPosts) {
    // Create post
    const post = await prisma.post.create({
      data: {
        workspaceId: demoWorkspace.id,
        title: postData.title,
        baseContent: postData.baseContent,
        status: postData.status as any,
        ownerId: demoUser.id,
        scheduledAt: postData.scheduledAt || null,
        publishedAt: postData.publishedAt || null,
        tags: [],
      },
    })

    // Create variants for each platform
    const accountsForPlatforms = await prisma.socialAccount.findMany({
      where: {
        workspaceId: demoWorkspace.id,
        provider: { in: postData.platforms as any[] },
      },
    })

    for (const account of accountsForPlatforms) {
      await prisma.postVariant.create({
        data: {
          postId: post.id,
          socialAccountId: account.id,
          text: postData.baseContent,
          hashtags: extractHashtags(postData.baseContent),
          status: postData.status === 'PUBLISHED' ? 'PUBLISHED' : 'PENDING',
          publishedAt: postData.status === 'PUBLISHED' ? postData.publishedAt : null,
        },
      })
    }

    // Add some demo metrics for published posts
    if (postData.status === 'PUBLISHED') {
      for (const account of accountsForPlatforms) {
        // Create sample metrics
        await prisma.analyticsMetric.createMany({
          data: [
            {
              workspaceId: demoWorkspace.id,
              userId: demoUser.id,
              socialAccountId: account.id,
              postId: post.id,
              date: new Date(),
              platform: account.provider,
              metricType: 'reach',
              value: Math.floor(Math.random() * 10000) + 1000,
            },
            {
              workspaceId: demoWorkspace.id,
              userId: demoUser.id,
              socialAccountId: account.id,
              postId: post.id,
              date: new Date(),
              platform: account.provider,
              metricType: 'engagement',
              value: Math.floor(Math.random() * 1000) + 100,
            },
            {
              workspaceId: demoWorkspace.id,
              userId: demoUser.id,
              socialAccountId: account.id,
              postId: post.id,
              date: new Date(),
              platform: account.provider,
              metricType: 'clicks',
              value: Math.floor(Math.random() * 100) + 10,
            },
          ],
        })
      }
    }

    console.log(`✅ Created post: ${postData.title}`)
  }

  console.log('🎉 Database seeding completed!')
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