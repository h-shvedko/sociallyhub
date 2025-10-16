import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Default landing page configuration
const DEFAULT_CONFIG = {
  hero: {
    title: "Manage All Your Social Media From One Platform",
    subtitle: "Schedule, publish, and analyze your social media content across all platforms with SociallyHub's powerful automation tools.",
    ctaText: "Get Started Free",
    ctaUrl: "/auth/signup",
    backgroundImage: "/images/hero-bg.jpg",
    videoUrl: null
  },
  features: {
    title: "Everything You Need to Succeed",
    subtitle: "Powerful features to streamline your social media management",
    items: [
      {
        title: "Multi-Platform Publishing",
        description: "Schedule and publish to all major social media platforms from one dashboard.",
        icon: "share",
        image: "/images/feature-1.jpg"
      },
      {
        title: "Advanced Analytics",
        description: "Get detailed insights into your performance with comprehensive analytics.",
        icon: "chart",
        image: "/images/feature-2.jpg"
      },
      {
        title: "AI-Powered Content",
        description: "Let AI help you create engaging content that resonates with your audience.",
        icon: "ai",
        image: "/images/feature-3.jpg"
      }
    ]
  },
  testimonials: {
    title: "Trusted by 10,000+ Businesses",
    subtitle: "See what our customers say about SociallyHub",
    items: [
      {
        name: "Sarah Johnson",
        role: "Marketing Director",
        company: "TechStart Inc.",
        content: "SociallyHub has completely transformed how we manage our social media. The automation features save us hours every week.",
        avatar: "/images/avatar-1.jpg",
        rating: 5
      }
    ]
  },
  pricing: {
    title: "Choose Your Plan",
    subtitle: "Flexible pricing for teams of all sizes",
    plans: [
      {
        name: "Starter",
        price: 29,
        period: "month",
        description: "Perfect for small businesses getting started",
        features: ["5 Social accounts", "100 Posts per month", "Basic analytics", "Email support"],
        ctaText: "Start Free Trial",
        featured: false
      },
      {
        name: "Professional",
        price: 79,
        period: "month", 
        description: "Best for growing businesses",
        features: ["15 Social accounts", "Unlimited posts", "Advanced analytics", "AI content assistant", "Priority support"],
        ctaText: "Start Free Trial",
        featured: true
      }
    ]
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to the workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get landing page config for the workspace
    let landingPageConfig = await prisma.landingPageConfig.findUnique({
      where: { workspaceId }
    })

    // If no config exists, create default config
    if (!landingPageConfig) {
      landingPageConfig = await prisma.landingPageConfig.create({
        data: {
          workspaceId,
          heroConfig: DEFAULT_CONFIG.hero,
          featuresConfig: DEFAULT_CONFIG.features,
          testimonialsConfig: DEFAULT_CONFIG.testimonials,
          pricingConfig: DEFAULT_CONFIG.pricing,
          ctaConfig: {
            title: "Ready to Get Started?",
            subtitle: "Join thousands of businesses already using SociallyHub",
            ctaText: "Start Your Free Trial",
            ctaUrl: "/auth/signup"
          },
          footerConfig: {
            companyName: "SociallyHub",
            description: "The complete social media management platform",
            links: {
              product: ["Features", "Pricing", "API", "Integrations"],
              company: ["About", "Blog", "Careers", "Contact"],
              support: ["Help Center", "Community", "Status"]
            },
            socialLinks: {
              twitter: "https://twitter.com/sociallyhub",
              facebook: "https://facebook.com/sociallyhub",
              linkedin: "https://linkedin.com/company/sociallyhub"
            }
          }
        }
      })
    }

    return NextResponse.json({ config: landingPageConfig })
  } catch (error) {
    console.error('Error fetching landing page config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const body = await request.json()
    const { workspaceId, ...configData } = body

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to the workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Validate and sanitize input
    const allowedFields = [
      'title', 'description', 'keywords', 'heroConfig', 'featuresConfig',
      'testimonialsConfig', 'pricingConfig', 'ctaConfig', 'footerConfig',
      'analyticsCode', 'seoConfig', 'customSections', 'isPublished'
    ]

    const updateData: any = {}
    for (const [key, value] of Object.entries(configData)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }

    // If publishing, set publishedAt timestamp
    if (updateData.isPublished) {
      updateData.publishedAt = new Date()
      updateData.version = { increment: 1 }
    }

    // Upsert landing page config
    const landingPageConfig = await prisma.landingPageConfig.upsert({
      where: { workspaceId },
      update: updateData,
      create: {
        workspaceId,
        heroConfig: DEFAULT_CONFIG.hero,
        featuresConfig: DEFAULT_CONFIG.features,
        testimonialsConfig: DEFAULT_CONFIG.testimonials,
        pricingConfig: DEFAULT_CONFIG.pricing,
        ...updateData
      }
    })

    return NextResponse.json({ 
      config: landingPageConfig,
      message: 'Landing page configuration updated successfully' 
    })
  } catch (error) {
    console.error('Error updating landing page config:', error)
    return NextResponse.json(
      { error: 'Failed to update landing page configuration' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const { workspaceId, action } = await request.json()

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to the workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    switch (action) {
      case 'publish':
        await prisma.landingPageConfig.update({
          where: { workspaceId },
          data: {
            isPublished: true,
            publishedAt: new Date(),
            version: { increment: 1 }
          }
        })
        return NextResponse.json({ message: 'Landing page published successfully' })

      case 'unpublish':
        await prisma.landingPageConfig.update({
          where: { workspaceId },
          data: {
            isPublished: false
          }
        })
        return NextResponse.json({ message: 'Landing page unpublished' })

      case 'preview':
        const config = await prisma.landingPageConfig.findUnique({
          where: { workspaceId }
        })
        return NextResponse.json({ 
          previewUrl: `/preview/${workspaceId}`,
          config 
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error performing landing page action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}