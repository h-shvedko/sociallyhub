import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { getOpenAIClient, getAIModel, estimateCostCents } from '@/lib/ai/config'
import { getAIAvailability } from '@/lib/ai/availability'

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

    // Verify workspace access (ADR-0004): any member of THIS workspace.
    // The membership row carries the normalized userId for usage tracking.
    const membership = await requireWorkspaceRole(workspaceId)

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

    // ADR-0018: this route calls OpenAI directly, so it only runs when the
    // real provider is available. Demo-mode 'mock' cannot honestly serve a
    // content analysis, so both 'mock' and 'none' return enabled:false.
    const availability = getAIAvailability()
    if (availability.provider !== 'openai') {
      return NextResponse.json({
        enabled: false,
        suggestions: [],
        trends: [],
        gaps: [],
        aiProvider: availability.provider,
        simulated: false,
        message: availability.reason || 'Configure OPENAI_API_KEY to enable AI features'
      })
    }

    // Analyze content with OpenAI
    const contentAnalysis = await analyzeContentWithAI(recentPosts, {
      workspaceId,
      userId: membership.userId
    })

    return NextResponse.json({
      enabled: true,
      suggestions: contentAnalysis.suggestions,
      trends: contentAnalysis.trends,
      gaps: contentAnalysis.gaps,
      aiProvider: 'openai',
      simulated: false,
      lastAnalyzed: new Date().toISOString()
    })
  } catch (error) {
    return handleApiError(error)
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

    // Verify workspace access (ADR-0004): same role set as the old inline check.
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

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
    return handleApiError(error)
  }
}

/**
 * Best-effort AIUsageTracking write. NOTE: AIFeatureType has no
 * automation/analysis-specific value, so this is recorded as
 * CONTENT_GENERATION (the closest valid enum member).
 */
async function trackContentIntelligenceUsage(params: {
  workspaceId: string
  userId: string
  model: string
  tokensUsed: number
  costCents: number
  responseTimeMs: number
  successful: boolean
  errorMessage?: string
}): Promise<void> {
  try {
    await prisma.aIUsageTracking.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        featureType: 'CONTENT_GENERATION',
        tokensUsed: params.tokensUsed,
        costCents: params.costCents,
        responseTimeMs: params.responseTimeMs,
        model: params.model,
        successful: params.successful,
        errorMessage: params.errorMessage
      }
    })
  } catch (trackingError) {
    // Tracking must never break the primary flow
    console.error('Failed to record AI usage for content intelligence:', trackingError)
  }
}

async function analyzeContentWithAI(
  posts: any[],
  usage: { workspaceId: string; userId: string }
): Promise<{
  suggestions: any[]
  trends: any[]
  gaps: any[]
}> {
  if (posts.length === 0) {
    return { suggestions: [], trends: [], gaps: [] }
  }

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

  const model = getAIModel()
  const startTime = Date.now()

  try {
    const client = getOpenAIClient()
    const completion = await client.chat.completions.create({
      model,
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

    await trackContentIntelligenceUsage({
      workspaceId: usage.workspaceId,
      userId: usage.userId,
      model,
      tokensUsed: completion.usage?.total_tokens ?? 0,
      costCents: estimateCostCents(
        model,
        completion.usage?.prompt_tokens ?? 0,
        completion.usage?.completion_tokens ?? 0
      ),
      responseTimeMs: Date.now() - startTime,
      successful: true
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{"suggestions":[],"trends":[],"gaps":[]}')
    return analysis
  } catch (error) {
    await trackContentIntelligenceUsage({
      workspaceId: usage.workspaceId,
      userId: usage.userId,
      model,
      tokensUsed: 0,
      costCents: 0,
      responseTimeMs: Date.now() - startTime,
      successful: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    })

    // HONESTY (ADR-0018): the previous hardcoded "fallback insights" were
    // fabricated analysis presented as real. A clear error beats fake data —
    // propagate so the route's handleApiError answers honestly.
    console.error('Error in AI content analysis:', error)
    throw error
  }
}
