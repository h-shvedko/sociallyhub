import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedClientReports } from '../src/lib/seeders/client-reports-seeder'

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
        canManageTeam: true,
        canManageContent: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageBilling: true,
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

  // Create demo campaigns with budget data
  const demoCampaigns = [
    {
      id: 'spring-campaign-2024',
      name: 'Spring Product Launch 2024',
      description: 'Launch campaign for our new spring collection with focus on social media engagement',
      status: 'ACTIVE',
      type: 'BRAND_AWARENESS',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-05-31'),
      budget: {
        totalBudget: 15000,
        spentAmount: 8750,
        dailyBudget: 500,
        currency: 'USD'
      },
      objectives: {
        reach: 100000,
        engagement: 5000,
        conversions: 250
      }
    },
    {
      id: 'summer-sale-2024',
      name: 'Summer Sale Campaign',
      description: 'Promotional campaign for summer sale with targeted ads and social content',
      status: 'ACTIVE',
      type: 'LEAD_GENERATION',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-08-15'),
      budget: {
        totalBudget: 25000,
        spentAmount: 12300,
        dailyBudget: 750,
        currency: 'USD'
      },
      objectives: {
        leads: 500,
        sales: 150,
        roas: 4.5
      }
    },
    {
      id: 'brand-awareness-q2',
      name: 'Q2 Brand Awareness',
      description: 'Ongoing brand awareness campaign focusing on thought leadership content',
      status: 'ACTIVE',
      type: 'ENGAGEMENT',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30'),
      budget: {
        totalBudget: 8000,
        spentAmount: 6200,
        dailyBudget: 200,
        currency: 'USD'
      },
      objectives: {
        brandAwareness: 80,
        thoughtLeadership: 60,
        communityGrowth: 1000
      }
    },
    {
      id: 'holiday-prep-2024',
      name: 'Holiday Preparation Campaign',
      description: 'Early holiday season campaign to build momentum before peak season',
      status: 'PAUSED',
      type: 'SALES',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-11-30'),
      budget: {
        totalBudget: 35000,
        spentAmount: 2100,
        dailyBudget: 1000,
        currency: 'USD'
      },
      objectives: {
        sales: 300,
        revenue: 50000,
        customerAcquisition: 200
      }
    },
    {
      id: 'customer-retention-q3',
      name: 'Customer Retention Q3',
      description: 'Focus on existing customer engagement and retention through personalized content',
      status: 'COMPLETED',
      type: 'CUSTOM',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-09-30'),
      budget: {
        totalBudget: 12000,
        spentAmount: 11850,
        dailyBudget: 400,
        currency: 'USD'
      },
      objectives: {
        retention: 85,
        engagement: 3000,
        satisfaction: 90
      }
    }
  ]

  for (const campaignData of demoCampaigns) {
    const campaign = await prisma.campaign.upsert({
      where: { id: campaignData.id },
      update: {
        budget: campaignData.budget
      },
      create: {
        ...campaignData,
        workspaceId: demoWorkspace.id,
      },
    })
    console.log(`✅ Created campaign: ${campaign.name}`)
  }

  // Create demo clients with complete realistic data
  const demoClients = [
    {
      id: 'acme-corp-client',
      name: 'Acme Corporation',
      email: 'contact@acmecorp.com',
      company: 'Acme Corporation',
      industry: 'Technology',
      website: 'https://acmecorp.com',
      phone: '+1 (555) 123-4567',
      status: 'ACTIVE',
      notes: 'Large enterprise client focused on B2B software solutions. Requires regular reporting and high-touch service.',
      labels: ['Enterprise', 'Technology', 'Priority']
    },
    {
      id: 'techstart-client', 
      name: 'TechStart Inc.',
      email: 'hello@techstart.io',
      company: 'TechStart Inc.',
      industry: 'Technology',
      website: 'https://techstart.io',
      phone: '+1 (555) 987-6543',
      status: 'ACTIVE',
      notes: 'Fast-growing startup in the AI space. Very responsive to new features and experimental campaigns.',
      labels: ['Startup', 'Technology', 'Growth']
    },
    {
      id: 'global-retail-client',
      name: 'Global Retail Co.',
      email: 'marketing@globalretail.com',
      company: 'Global Retail Co.',
      industry: 'Retail',
      website: 'https://globalretail.com',
      phone: '+1 (555) 555-0123',
      status: 'ACTIVE',
      notes: 'Multi-channel retailer with strong seasonal campaigns. Focus on holiday marketing and product launches.',
      labels: ['Retail', 'Large Enterprise', 'E-commerce']
    },
    {
      id: 'healthcare-plus-client',
      name: 'Healthcare Plus',
      email: 'info@healthcareplus.org',
      company: 'Healthcare Plus',
      industry: 'Healthcare',
      website: 'https://healthcareplus.org',
      phone: '+1 (555) 234-5678',
      status: 'ACTIVE',
      notes: 'Healthcare nonprofit focused on community outreach. Requires compliance-focused content and messaging.',
      labels: ['Healthcare', 'Compliance', 'B2B']
    },
    {
      id: 'edu-solutions-client',
      name: 'Educational Solutions',
      email: 'team@edusolutions.edu',
      company: 'Educational Solutions',
      industry: 'Education',
      website: 'https://edusolutions.edu',
      phone: '+1 (555) 345-6789',
      status: 'ACTIVE',
      notes: 'Educational technology provider serving K-12 schools. Focuses on teacher and parent engagement campaigns.',
      labels: ['Education', 'Non-profit', 'Community']
    },
    {
      id: 'new-startup-client',
      name: 'New Startup Ventures',
      email: 'hello@newstartup.com',
      company: 'New Startup Ventures',
      industry: 'Technology',
      website: 'https://newstartup.com',
      phone: '+1 (555) 111-2222',
      status: 'PROSPECT',
      notes: 'Recently signed startup client currently going through onboarding process.',
      labels: ['Startup', 'New Client', 'Technology']
    },
    {
      id: 'prospect-client',
      name: 'Prospect Manufacturing Co.',
      email: 'contact@prospect-mfg.com',
      company: 'Prospect Manufacturing Co.',
      industry: 'Manufacturing',
      website: 'https://prospect-mfg.com',
      phone: '+1 (555) 333-4444',
      status: 'PROSPECT',
      notes: 'Prospective client who has shown interest but not yet started onboarding.',
      labels: ['Prospect', 'Manufacturing', 'B2B']
    },
    {
      id: 'stalled-client',
      name: 'Stalled Progress Inc.',
      email: 'info@stalledprogress.com',
      company: 'Stalled Progress Inc.',
      industry: 'Consulting',
      website: 'https://stalledprogress.com',
      phone: '+1 (555) 555-6666',
      status: 'ON_HOLD',
      notes: 'Onboarding process has stalled due to internal restructuring at client company.',
      labels: ['Stalled', 'Consulting', 'On Hold']
    }
  ]

  for (const clientData of demoClients) {
    const client = await prisma.client.upsert({
      where: { id: clientData.id },
      update: {},
      create: {
        ...clientData,
        workspaceId: demoWorkspace.id,
      },
    })
    console.log(`✅ Created client: ${client.name}`)
  }

  // Seed client reports
  await seedClientReports()

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