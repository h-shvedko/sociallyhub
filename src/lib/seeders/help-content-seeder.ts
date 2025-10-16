import { PrismaClient } from '@prisma/client'
import { calculateReadingTime } from '../utils/reading-time'

const prisma = new PrismaClient()

// Help categories with their slugs and icons
const HELP_CATEGORIES = [
  {
    name: 'Getting Started',
    slug: 'getting-started',
    description: 'Learn the basics and get up and running quickly',
    icon: 'Rocket',
    sortOrder: 1
  },
  {
    name: 'Content & Posting',
    slug: 'content-posting',
    description: 'Everything about creating and managing content',
    icon: 'Edit',
    sortOrder: 2
  },
  {
    name: 'Analytics',
    slug: 'analytics',
    description: 'Understanding your performance metrics and reports',
    icon: 'TrendingUp',
    sortOrder: 3
  },
  {
    name: 'Team Management',
    slug: 'team-management',
    description: 'Manage team members, roles, and permissions',
    icon: 'Users',
    sortOrder: 4
  },
  {
    name: 'AI & Automation',
    slug: 'ai-automation',
    description: 'AI tools and automation features',
    icon: 'Cpu',
    sortOrder: 5
  },
  {
    name: 'Integrations',
    slug: 'integrations',
    description: 'Connect with other tools and platforms',
    icon: 'Link',
    sortOrder: 6
  },
  {
    name: 'Billing & Plans',
    slug: 'billing-plans',
    description: 'Subscription management and billing information',
    icon: 'CreditCard',
    sortOrder: 7
  },
  {
    name: 'Security & Privacy',
    slug: 'security-privacy',
    description: 'Keep your account and data secure',
    icon: 'Shield',
    sortOrder: 8
  }
]

// Help articles data
const HELP_ARTICLES = [
  // Getting Started Articles
  {
    categorySlug: 'getting-started',
    title: 'Welcome to SociallyHub',
    slug: 'welcome-to-sociallyhub',
    excerpt: 'Get started with SociallyHub and learn how to navigate the platform',
    content: `# Welcome to SociallyHub

Welcome to your new social media management platform! This guide will help you get started with SociallyHub and make the most of its features.

## What is SociallyHub?

SociallyHub is a comprehensive social media management platform designed to help businesses and creators manage their social media presence efficiently. With SociallyHub, you can:

- **Schedule posts** across multiple social media platforms
- **Analyze performance** with detailed analytics
- **Collaborate with teams** using role-based permissions
- **Automate responses** with AI-powered tools
- **Manage client relationships** with built-in CRM features

## Getting Started

### 1. Complete Your Profile
Start by completing your profile information. This helps personalize your experience and enables team collaboration features.

### 2. Connect Your Social Accounts
Navigate to the Accounts section and connect your social media accounts. We support Twitter, Facebook, Instagram, LinkedIn, YouTube, and TikTok.

### 3. Create Your First Post
Head to the Content section and create your first post. You can schedule it for later or publish immediately.

### 4. Explore Analytics
Once you have some posts published, check out the Analytics dashboard to see how they're performing.

## Key Features to Explore

- **Dashboard**: Get an overview of your social media performance
- **Content Calendar**: Visualize and manage your content schedule
- **Inbox**: Manage all your social media interactions in one place
- **Automation**: Set up rules to automate repetitive tasks
- **Team**: Invite team members and manage permissions

## Need Help?

If you need assistance at any point:
- Check our Help Center for detailed guides
- Use the live chat feature for immediate support
- Join our community forum to connect with other users

Happy posting! 🚀`,
    tags: ['onboarding', 'quickstart', 'basics'],
    readingTime: 5,
    status: 'published'
  },
  {
    categorySlug: 'getting-started',
    title: 'Connecting Your Social Media Accounts',
    slug: 'connecting-social-media-accounts',
    excerpt: 'Learn how to connect and manage your social media accounts in SociallyHub',
    content: `# Connecting Your Social Media Accounts

This guide will walk you through connecting your social media accounts to SociallyHub.

## Supported Platforms

SociallyHub currently supports the following platforms:
- Twitter/X
- Facebook (Pages and Groups)
- Instagram (Business and Creator accounts)
- LinkedIn (Personal and Company pages)
- YouTube
- TikTok

## How to Connect an Account

1. Navigate to **Settings > Accounts**
2. Click **"Add Account"**
3. Select the platform you want to connect
4. Follow the authentication flow
5. Grant necessary permissions

## Authentication Process

### Twitter/X
- You'll be redirected to Twitter's authorization page
- Log in with your Twitter credentials
- Authorize SociallyHub to access your account

### Facebook & Instagram
- Connect through Facebook Business Manager
- Select the pages and Instagram accounts you want to manage
- Grant required permissions for posting and analytics

### LinkedIn
- Choose between personal profile or company page
- Authenticate with LinkedIn
- Select the specific pages to manage

## Managing Connected Accounts

### Account Settings
- Customize posting defaults for each account
- Set account-specific hashtags
- Configure notification preferences

### Permissions
- Review and update granted permissions
- Reconnect if authentication expires
- Remove accounts you no longer need

## Troubleshooting

### Common Issues
- **Authentication Failed**: Try clearing your browser cache and cookies
- **Missing Permissions**: Reconnect the account and ensure all permissions are granted
- **Account Not Showing**: Refresh the page or log out and back in

### Security Best Practices
- Regularly review connected accounts
- Remove unused accounts
- Use two-factor authentication on your social accounts
- Monitor account activity regularly`,
    tags: ['accounts', 'authentication', 'setup'],
    readingTime: 4,
    status: 'published'
  },

  // Content & Posting Articles
  {
    categorySlug: 'content-posting',
    title: 'Creating and Scheduling Posts',
    slug: 'creating-scheduling-posts',
    excerpt: 'Master the art of creating and scheduling content across multiple platforms',
    content: `# Creating and Scheduling Posts

Learn how to create engaging content and schedule it for optimal times.

## Creating a Post

### Basic Post Creation
1. Navigate to **Content > Create Post**
2. Select the accounts you want to post to
3. Write your content
4. Add images, videos, or GIFs
5. Preview how it looks on each platform

### Platform-Specific Features
- **Twitter**: Thread creation, polls, quote tweets
- **Instagram**: Carousel posts, Stories, Reels
- **Facebook**: Albums, events, offers
- **LinkedIn**: Articles, documents, polls

## Scheduling Options

### One-Time Posts
- Set specific date and time
- Use timezone settings for accuracy
- Schedule up to 1 year in advance

### Recurring Posts
- Daily, weekly, or monthly schedules
- Perfect for regular content series
- Automatically adjusts for timezones

### Best Time Suggestions
- AI-powered optimal timing
- Based on your audience activity
- Platform-specific recommendations

## Content Optimization

### Hashtag Suggestions
- AI-generated relevant hashtags
- Trending hashtag alerts
- Save hashtag groups for reuse

### Content Ideas
- AI content suggestions
- Trending topics in your industry
- Performance-based recommendations

## Advanced Features

### A/B Testing
- Test different versions of posts
- Analyze performance metrics
- Automatically publish winning version

### Content Templates
- Save post templates
- Include variable placeholders
- Share templates with team`,
    tags: ['content', 'scheduling', 'posting'],
    readingTime: 6,
    status: 'published'
  },
  {
    categorySlug: 'content-posting',
    title: 'Using the Content Calendar',
    slug: 'using-content-calendar',
    excerpt: 'Visualize and manage your content strategy with the content calendar',
    content: `# Using the Content Calendar

The content calendar is your command center for content planning and management.

## Calendar Views

### Month View
- See entire month at a glance
- Drag and drop to reschedule
- Color-coded by platform or campaign

### Week View
- Detailed weekly planning
- Hour-by-hour scheduling
- Quick post creation from timeslots

### Day View
- Minute-level scheduling
- Ideal for real-time management
- See all platform activities

## Calendar Features

### Filtering Options
- Filter by platform
- Filter by campaign
- Filter by team member
- Filter by post status

### Quick Actions
- Edit posts directly from calendar
- Duplicate successful posts
- Delete or archive old content
- Approve team posts

## Content Planning

### Campaign Management
- Group related posts
- Track campaign performance
- Set campaign budgets and goals

### Content Themes
- Assign themes to days/weeks
- Maintain consistent messaging
- Balance content types

## Collaboration Features

### Team Workflows
- Submit posts for approval
- Leave comments and feedback
- Track revision history
- Set publishing permissions`,
    tags: ['calendar', 'planning', 'organization'],
    readingTime: 5,
    status: 'published'
  },

  // Analytics Articles
  {
    categorySlug: 'analytics',
    title: 'Understanding Your Analytics Dashboard',
    slug: 'understanding-analytics-dashboard',
    excerpt: 'Make data-driven decisions with comprehensive analytics',
    content: `# Understanding Your Analytics Dashboard

Learn how to interpret and use your analytics data effectively.

## Dashboard Overview

### Key Metrics
- **Reach**: Total unique users who saw your content
- **Impressions**: Total number of times content was displayed
- **Engagement**: Likes, comments, shares, and clicks
- **Growth**: Follower changes over time

## Performance Tracking

### Post Performance
- Individual post metrics
- Engagement rates
- Best performing content
- Optimal posting times

### Audience Insights
- Demographics breakdown
- Geographic distribution
- Active hours analysis
- Device and platform usage

## Custom Reports

### Creating Reports
- Select date ranges
- Choose metrics to include
- Add comparison periods
- Export in multiple formats

### Automated Reporting
- Schedule regular reports
- Email to stakeholders
- Customizable templates
- White-label options

## Advanced Analytics

### Competitor Analysis
- Track competitor performance
- Industry benchmarks
- Share of voice metrics
- Content gap analysis

### ROI Tracking
- Link clicks and conversions
- Campaign attribution
- Revenue tracking
- Cost per engagement`,
    tags: ['analytics', 'metrics', 'reporting'],
    readingTime: 7,
    status: 'published'
  },

  // Team Management Articles
  {
    categorySlug: 'team-management',
    title: 'Managing Team Members and Roles',
    slug: 'managing-team-members-roles',
    excerpt: 'Learn how to add team members and manage their permissions',
    content: `# Managing Team Members and Roles

Collaborate effectively with your team using role-based permissions.

## User Roles

### Owner
- Full platform access
- Billing management
- Delete workspace ability
- Transfer ownership

### Admin
- Manage team members
- Configure integrations
- Access all features
- View billing (no changes)

### Publisher
- Create and publish content
- Manage social accounts
- View analytics
- Respond to messages

### Analyst
- View all analytics
- Generate reports
- Export data
- Read-only content access

### Client Viewer
- Limited dashboard access
- View specific reports
- No editing capabilities
- Custom permission sets

## Inviting Team Members

### Send Invitations
1. Go to Settings > Team
2. Click "Invite Member"
3. Enter email address
4. Select role
5. Add custom message (optional)

### Invitation Management
- Track pending invites
- Resend invitations
- Revoke access
- Set expiration dates

## Permission Management

### Custom Permissions
- Create custom roles
- Granular access control
- Platform-specific permissions
- Feature-based restrictions

### Security Features
- Two-factor authentication
- Session management
- Activity logs
- IP restrictions`,
    tags: ['team', 'collaboration', 'permissions'],
    readingTime: 6,
    status: 'published'
  },

  // AI & Automation Articles
  {
    categorySlug: 'ai-automation',
    title: 'AI-Powered Content Creation',
    slug: 'ai-powered-content-creation',
    excerpt: 'Leverage AI to create engaging content and save time',
    content: `# AI-Powered Content Creation

Use artificial intelligence to enhance your content creation process.

## AI Writing Assistant

### Content Generation
- Generate post ideas
- Write engaging captions
- Create content variations
- Adapt tone and style

### Content Optimization
- Improve readability
- Suggest better wording
- Check grammar and spelling
- Optimize for engagement

## AI Image Tools

### Image Generation
- Create custom graphics
- Generate backgrounds
- Design templates
- Brand consistency

### Image Optimization
- Auto-crop for platforms
- Enhance image quality
- Remove backgrounds
- Add text overlays

## Smart Suggestions

### Hashtag Recommendations
- Trending hashtags
- Niche-specific tags
- Optimal tag count
- Performance predictions

### Posting Time Optimization
- Best time predictions
- Audience activity analysis
- Platform-specific timing
- Timezone adjustments

## Automation Rules

### Response Automation
- Auto-reply to mentions
- Thank new followers
- Answer FAQs
- Route inquiries

### Content Automation
- RSS feed posting
- Weather-based content
- Event triggers
- Milestone celebrations`,
    tags: ['ai', 'automation', 'content-creation'],
    readingTime: 8,
    status: 'published'
  }
]

// FAQ data
const HELP_FAQS = [
  // Getting Started FAQs
  {
    categorySlug: 'getting-started',
    question: 'How do I get started with SociallyHub?',
    answer: 'Getting started is easy! First, complete your profile setup, then connect your social media accounts, create your first post, and explore the dashboard. We recommend starting with our Quick Start guide in the Help Center.',
    sortOrder: 1,
    isPinned: true
  },
  {
    categorySlug: 'getting-started',
    question: 'What social media platforms does SociallyHub support?',
    answer: 'SociallyHub supports Twitter/X, Facebook (Pages and Groups), Instagram (Business and Creator accounts), LinkedIn (Personal and Company pages), YouTube, and TikTok. We\'re constantly working on adding more platforms.',
    sortOrder: 2
  },
  {
    categorySlug: 'getting-started',
    question: 'Can I try SociallyHub for free?',
    answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required to start your trial. After the trial, you can choose from our various pricing plans.',
    sortOrder: 3
  },

  // Content & Posting FAQs
  {
    categorySlug: 'content-posting',
    question: 'How far in advance can I schedule posts?',
    answer: 'You can schedule posts up to 1 year in advance. This allows for long-term content planning and seasonal campaigns. Posts can be scheduled down to the minute in your preferred timezone.',
    sortOrder: 1
  },
  {
    categorySlug: 'content-posting',
    question: 'Can I edit a post after it\'s been scheduled?',
    answer: 'Yes! You can edit any scheduled post up until it\'s published. Simply go to your content calendar or scheduled posts list, click on the post, and make your changes. The post will remain scheduled for the same time.',
    sortOrder: 2
  },
  {
    categorySlug: 'content-posting',
    question: 'What file types are supported for media uploads?',
    answer: 'We support JPG, PNG, GIF, and WebP for images (up to 10MB each), and MP4, MOV, and AVI for videos (up to 100MB). Different platforms have different requirements, and we\'ll automatically optimize your media for each platform.',
    sortOrder: 3
  },

  // Analytics FAQs
  {
    categorySlug: 'analytics',
    question: 'How often is analytics data updated?',
    answer: 'Analytics data is updated in real-time for most metrics. Some platforms may have a slight delay (usually 5-15 minutes) due to their API limitations. Historical data is refreshed every hour.',
    sortOrder: 1
  },
  {
    categorySlug: 'analytics',
    question: 'Can I export my analytics data?',
    answer: 'Yes! You can export analytics data in multiple formats including CSV, Excel, and PDF. You can also schedule automated reports to be emailed to you or your clients on a daily, weekly, or monthly basis.',
    sortOrder: 2
  },

  // Team Management FAQs
  {
    categorySlug: 'team-management',
    question: 'How many team members can I add?',
    answer: 'The number of team members depends on your subscription plan. Starter plans allow up to 3 users, Professional up to 10, and Enterprise plans have unlimited users. Check our pricing page for detailed information.',
    sortOrder: 1
  },
  {
    categorySlug: 'team-management',
    question: 'Can I set different permissions for team members?',
    answer: 'Absolutely! We have predefined roles (Owner, Admin, Publisher, Analyst, Client Viewer) with specific permissions. You can also create custom roles with granular permissions for specific features and platforms.',
    sortOrder: 2
  },

  // AI & Automation FAQs
  {
    categorySlug: 'ai-automation',
    question: 'How does the AI content generation work?',
    answer: 'Our AI uses advanced language models to generate content based on your input, brand voice, and historical performance. You can provide topics, keywords, or examples, and the AI will create engaging content suggestions tailored to each platform.',
    sortOrder: 1
  },
  {
    categorySlug: 'ai-automation',
    question: 'Can I customize automation rules?',
    answer: 'Yes! You can create custom automation rules based on triggers like mentions, keywords, time of day, or user actions. Set up auto-responses, content routing, or notification rules to streamline your workflow.',
    sortOrder: 2
  },

  // Billing FAQs
  {
    categorySlug: 'billing-plans',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, MasterCard, American Express, Discover), PayPal, and ACH/wire transfers for Enterprise plans. All payments are processed securely through Stripe.',
    sortOrder: 1,
    isPinned: true
  },
  {
    categorySlug: 'billing-plans',
    question: 'Can I change my plan anytime?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll have immediate access to new features. When downgrading, changes take effect at the next billing cycle.',
    sortOrder: 2
  },
  {
    categorySlug: 'billing-plans',
    question: 'Do you offer refunds?',
    answer: 'We offer a 30-day money-back guarantee for new subscriptions. If you\'re not satisfied within the first 30 days, contact our support team for a full refund. After 30 days, we offer prorated credits for unused time.',
    sortOrder: 3
  },

  // Security FAQs
  {
    categorySlug: 'security-privacy',
    question: 'How is my data protected?',
    answer: 'We use industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit. All data is stored in SOC 2 compliant data centers with regular security audits and 24/7 monitoring.',
    sortOrder: 1
  },
  {
    categorySlug: 'security-privacy',
    question: 'Can I enable two-factor authentication?',
    answer: 'Yes! Two-factor authentication (2FA) is available for all accounts. You can enable it in your security settings using authenticator apps like Google Authenticator or Authy. We strongly recommend enabling 2FA for added security.',
    sortOrder: 2
  }
]

export async function seedHelpContent() {
  console.log('🌱 Seeding help content...')

  try {
    // Create categories
    const categories = await Promise.all(
      HELP_CATEGORIES.map(async (category) => {
        return await prisma.helpCategory.upsert({
          where: { slug: category.slug },
          update: category,
          create: category
        })
      })
    )

    console.log(`✅ Created ${categories.length} help categories`)

    // Create a map of category slugs to IDs
    const categoryMap = new Map(
      categories.map((cat) => [cat.slug, cat.id])
    )

    // Create articles
    let articleCount = 0
    for (const article of HELP_ARTICLES) {
      const categoryId = categoryMap.get(article.categorySlug)
      if (!categoryId) continue

      const { categorySlug, ...articleData } = article

      // Calculate reading time for the article
      const readingTime = calculateReadingTime(articleData.content)

      await prisma.helpArticle.upsert({
        where: { slug: articleData.slug },
        update: {
          ...articleData,
          categoryId,
          readingTime: readingTime.minutes,
          publishedAt: new Date()
        },
        create: {
          ...articleData,
          categoryId,
          readingTime: readingTime.minutes,
          publishedAt: new Date()
        }
      })
      articleCount++
    }

    console.log(`✅ Created ${articleCount} help articles`)

    // Create FAQs
    let faqCount = 0
    for (const faq of HELP_FAQS) {
      const categoryId = categoryMap.get(faq.categorySlug)
      if (!categoryId) continue

      const { categorySlug, ...faqData } = faq

      // Create a unique identifier for FAQ upsert (using question and category as unique combo)
      const existingFaq = await prisma.helpFAQ.findFirst({
        where: {
          question: faqData.question,
          categoryId
        }
      })

      if (existingFaq) {
        await prisma.helpFAQ.update({
          where: { id: existingFaq.id },
          data: {
            ...faqData,
            categoryId
          }
        })
      } else {
        await prisma.helpFAQ.create({
          data: {
            ...faqData,
            categoryId
          }
        })
      }
      faqCount++
    }

    console.log(`✅ Created ${faqCount} help FAQs`)

    // Add some initial view counts and votes for realism
    const allArticles = await prisma.helpArticle.findMany()
    for (const article of allArticles) {
      await prisma.helpArticle.update({
        where: { id: article.id },
        data: {
          views: Math.floor(Math.random() * 1000) + 100,
          helpfulVotes: Math.floor(Math.random() * 50) + 10,
          notHelpfulVotes: Math.floor(Math.random() * 10)
        }
      })
    }

    const allFaqs = await prisma.helpFAQ.findMany()
    for (const faq of allFaqs) {
      await prisma.helpFAQ.update({
        where: { id: faq.id },
        data: {
          views: Math.floor(Math.random() * 500) + 50,
          helpfulVotes: Math.floor(Math.random() * 30) + 5,
          notHelpfulVotes: Math.floor(Math.random() * 5)
        }
      })
    }

    console.log('✅ Help content seeding completed successfully!')

  } catch (error) {
    console.error('❌ Error seeding help content:', error)
    throw error
  }
}