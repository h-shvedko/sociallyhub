import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get recent posts for content analysis
    const recentPosts = await prisma.post.findMany({
      where: {
        workspaceId,
        status: 'PUBLISHED',
        publishedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: {
        variants: {
          include: {
            socialAccount: true
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: 20
    })

    if (!openai) {
      return NextResponse.json({
        enabled: false,
        suggestions: [],
        trends: [],
        gaps: [],
        message: 'OpenAI API key not configured'
      })
    }

    // Analyze content with OpenAI
    const contentAnalysis = await analyzeContentWithAI(recentPosts)

    return NextResponse.json({
      enabled: true,
      suggestions: contentAnalysis.suggestions,
      trends: contentAnalysis.trends,
      gaps: contentAnalysis.gaps,
      lastAnalyzed: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching content intelligence:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, action } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (action === 'enable') {
      // Create a content intelligence automation rule
      const rule = await prisma.automationRule.create({
        data: {
          workspaceId,
          name: 'Content Intelligence Auto-Analysis',
          description: 'Automatically analyze content performance and suggest improvements',
          ruleType: 'CONTENT_SUGGESTION',
          isActive: true,
          priority: 3,
          triggers: {
            schedule: 'daily',
            useTrending: true,
            performanceThreshold: 0.7
          },
          actions: {
            categories: ['Educational', 'Promotional', 'Behind-the-scenes'],
            suggestionsCount: 5,
            includeHashtags: true,
            analyzeTrends: true
          },
          maxExecutionsPerHour: 1,
          maxExecutionsPerDay: 1
        }
      })

      return NextResponse.json({ 
        message: 'Content Intelligence enabled successfully',
        ruleId: rule.id 
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error enabling content intelligence:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function analyzeContentWithAI(posts: any[]): Promise<{
  suggestions: any[]
  trends: any[]
  gaps: any[]
}> {
  if (!openai || posts.length === 0) {
    return { suggestions: [], trends: [], gaps: [] }
  }

  try {
    // Prepare content for analysis
    const contentSummary = posts.map(post => ({
      content: post.content,
      platform: post.variants[0]?.socialAccount?.provider || 'unknown',
      engagement: {
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0
      },
      publishedAt: post.publishedAt
    }))

    const prompt = `Analyze this social media content performance data and provide insights:

${JSON.stringify(contentSummary, null, 2)}

Please provide:
1. Content suggestions for improvement
2. Trending topics that should be leveraged
3. Content gaps that should be filled

Format as JSON with this structure:
{
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "Detailed suggestion",
      "priority": "high|medium|low",
      "category": "engagement|content|timing|hashtags"
    }
  ],
  "trends": [
    {
      "topic": "Trending topic",
      "relevance": "Why it's relevant",
      "actionable": "How to use it"
    }
  ],
  "gaps": [
    {
      "area": "Content area missing",
      "opportunity": "Why it's an opportunity",
      "recommendation": "What to do about it"
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a social media content strategist. Analyze the provided content data and give actionable insights for improving social media performance."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{"suggestions":[],"trends":[],"gaps":[]}')
    return analysis
  } catch (error) {
    console.error('Error in AI content analysis:', error)
    return {
      suggestions: [
        {
          title: "Increase Engagement",
          description: "Try posting during peak hours (9-11 AM, 7-9 PM) to maximize reach",
          priority: "medium",
          category: "timing"
        }
      ],
      trends: [
        {
          topic: "AI & Automation",
          relevance: "Growing interest in automation tools",
          actionable: "Share tips about social media automation"
        }
      ],
      gaps: [
        {
          area: "Video Content",
          opportunity: "Video posts typically get 2x more engagement",
          recommendation: "Create short-form video content weekly"
        }
      ]
    }
  }
}