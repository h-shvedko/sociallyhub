import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Content filtering keywords and patterns
const CONTENT_FILTERS = {
  profanity: [
    'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap',
    'piss', 'cock', 'dick', 'pussy', 'whore', 'slut', 'faggot'
  ],
  spam: [
    'buy now', 'click here', 'free money', 'make money fast', 'urgent',
    'limited time', 'act now', 'special offer', 'guaranteed', 'risk free',
    'no obligation', 'call now', 'don\'t delay', 'order now'
  ],
  hate: [
    'nazi', 'hitler', 'kill yourself', 'kys', 'terrorist', 'retard',
    'mental', 'stupid', 'idiot', 'moron', 'loser', 'pathetic'
  ],
  harassment: [
    'harassment', 'stalking', 'threatening', 'intimidation', 'bullying',
    'doxxing', 'personal info', 'address', 'phone number'
  ]
}

// URL and link patterns
const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /[a-zA-Z0-9.-]+\.(com|net|org|edu|gov|io|co)[^\s]*/gi
]

// Email patterns
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi

// Phone number patterns
const PHONE_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\(\d{3}\)\s?\d{3}[-.]?\d{4}/g,
  /\+\d{1,3}\s?\d{3,14}/g
]

interface ContentAnalysisResult {
  content: string
  flags: {
    profanity: number
    spam: number
    hate: number
    harassment: number
    urls: number
    emails: number
    phones: number
  }
  matches: {
    profanity: string[]
    spam: string[]
    hate: string[]
    harassment: string[]
    urls: string[]
    emails: string[]
    phones: string[]
  }
  score: number
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT'
  confidence: number
}

function analyzeContent(content: string): ContentAnalysisResult {
  const lowercaseContent = content.toLowerCase()
  const result: ContentAnalysisResult = {
    content,
    flags: {
      profanity: 0,
      spam: 0,
      hate: 0,
      harassment: 0,
      urls: 0,
      emails: 0,
      phones: 0
    },
    matches: {
      profanity: [],
      spam: [],
      hate: [],
      harassment: [],
      urls: [],
      emails: [],
      phones: []
    },
    score: 0,
    recommendation: 'APPROVE',
    confidence: 0.8
  }

  // Check profanity
  CONTENT_FILTERS.profanity.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    const matches = content.match(regex)
    if (matches) {
      result.flags.profanity += matches.length
      result.matches.profanity.push(...matches)
    }
  })

  // Check spam
  CONTENT_FILTERS.spam.forEach(phrase => {
    const regex = new RegExp(phrase, 'gi')
    const matches = content.match(regex)
    if (matches) {
      result.flags.spam += matches.length
      result.matches.spam.push(...matches)
    }
  })

  // Check hate speech
  CONTENT_FILTERS.hate.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    const matches = content.match(regex)
    if (matches) {
      result.flags.hate += matches.length
      result.matches.hate.push(...matches)
    }
  })

  // Check harassment
  CONTENT_FILTERS.harassment.forEach(word => {
    const regex = new RegExp(word, 'gi')
    const matches = content.match(regex)
    if (matches) {
      result.flags.harassment += matches.length
      result.matches.harassment.push(...matches)
    }
  })

  // Check URLs
  URL_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      result.flags.urls += matches.length
      result.matches.urls.push(...matches)
    }
  })

  // Check emails
  const emailMatches = content.match(EMAIL_PATTERN)
  if (emailMatches) {
    result.flags.emails = emailMatches.length
    result.matches.emails = emailMatches
  }

  // Check phone numbers
  PHONE_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      result.flags.phones += matches.length
      result.matches.phones.push(...matches)
    }
  })

  // Calculate risk score (0-100)
  result.score =
    (result.flags.profanity * 10) +
    (result.flags.spam * 15) +
    (result.flags.hate * 25) +
    (result.flags.harassment * 20) +
    (result.flags.urls * 5) +
    (result.flags.emails * 8) +
    (result.flags.phones * 8)

  // Make recommendation based on score
  if (result.score >= 50) {
    result.recommendation = 'REJECT'
    result.confidence = 0.9
  } else if (result.score >= 20) {
    result.recommendation = 'REVIEW'
    result.confidence = 0.85
  } else {
    result.recommendation = 'APPROVE'
    result.confidence = 0.8
  }

  return result
}

// POST /api/community/content-filtering - Analyze content for filtering
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const {
      content,
      contentType = 'TEXT', // TEXT, POST, REPLY, COMMENT
      targetId,
      workspaceId,
      autoAction = false // Whether to automatically take action based on result
    } = body

    // Validation
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Analyze the content
    const analysis = analyzeContent(content)

    // Store the analysis result
    const filterResult = await prisma.spamDetection.create({
      data: {
        workspaceId: workspaceId || null,
        targetType: contentType,
        targetId: targetId || null,
        content: content.substring(0, 1000), // Store first 1000 chars
        detectionType: 'CONTENT_FILTER',
        confidence: analysis.confidence,
        reasons: Object.entries(analysis.flags)
          .filter(([_, count]) => count > 0)
          .map(([type, count]) => `${type}: ${count} matches`),
        metadata: {
          flags: analysis.flags,
          matches: analysis.matches,
          score: analysis.score,
          recommendation: analysis.recommendation,
          contentLength: content.length,
          analysisTimestamp: new Date().toISOString()
        },
        status: analysis.recommendation === 'REJECT' ? 'CONFIRMED' :
                analysis.recommendation === 'REVIEW' ? 'PENDING' : 'FALSE_POSITIVE',
        autoDetected: true
      }
    })

    // If auto-action is enabled and user is authenticated
    if (autoAction && session?.user?.id && workspaceId && targetId) {
      // Verify user has moderation permissions
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (userWorkspace && ['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        if (analysis.recommendation === 'REJECT') {
          // Auto-reject content
          await prisma.moderationAction.create({
            data: {
              workspaceId,
              moderatorId: null, // System action
              actionType: 'REJECT',
              targetType: contentType === 'POST' ? 'FORUM_POST' : 'FORUM_REPLY',
              targetId,
              reason: 'Automatically rejected by content filter',
              description: `Content filter detected: ${Object.entries(analysis.flags)
                .filter(([_, count]) => count > 0)
                .map(([type, count]) => `${type} (${count})`)
                .join(', ')}`,
              isAutomatic: true,
              status: 'COMPLETED',
              reviewedAt: new Date()
            }
          })

          // Update the target content
          if (contentType === 'POST') {
            await prisma.communityForumPost.update({
              where: { id: targetId },
              data: { isApproved: false }
            })
          }
        } else if (analysis.recommendation === 'REVIEW') {
          // Add to moderation queue
          await prisma.moderationQueue.create({
            data: {
              workspaceId,
              targetType: contentType === 'POST' ? 'FORUM_POST' : 'FORUM_REPLY',
              targetId,
              title: `Content flagged for review: ${content.substring(0, 50)}...`,
              priority: 'HIGH',
              status: 'PENDING',
              metadata: {
                filterAnalysis: analysis,
                autoFlagged: true,
                filterScore: analysis.score
              }
            }
          })
        }
      }
    }

    return NextResponse.json({
      analysis,
      filterResult: {
        id: filterResult.id,
        recommendation: analysis.recommendation,
        score: analysis.score,
        confidence: analysis.confidence
      }
    })

  } catch (error) {
    console.error('Failed to analyze content:', error)
    return NextResponse.json(
      { error: 'Failed to analyze content' },
      { status: 500 }
    )
  }
}

// GET /api/community/content-filtering - Get content filtering statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const period = searchParams.get('period') || '7' // days

    // Verify user has moderation permissions
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    const periodDays = parseInt(period)
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

    // Get filtering statistics
    const [
      totalScanned,
      flaggedContent,
      autoRejected,
      pendingReview,
      filterByType,
      recentDetections
    ] = await Promise.all([
      // Total content scanned
      prisma.spamDetection.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate }
        }
      }),
      // Flagged content
      prisma.spamDetection.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate },
          status: { in: ['CONFIRMED', 'PENDING'] }
        }
      }),
      // Auto-rejected content
      prisma.spamDetection.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate },
          status: 'CONFIRMED'
        }
      }),
      // Content pending review
      prisma.spamDetection.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate },
          status: 'PENDING'
        }
      }),
      // Filter types breakdown
      prisma.spamDetection.groupBy({
        by: ['detectionType'],
        where: {
          workspaceId,
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),
      // Recent detections
      prisma.spamDetection.findMany({
        where: {
          workspaceId,
          status: { in: ['CONFIRMED', 'PENDING'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          detectionType: true,
          confidence: true,
          reasons: true,
          status: true,
          createdAt: true,
          content: true
        }
      })
    ])

    // Calculate filter effectiveness
    const effectivenessRate = totalScanned > 0 ?
      ((flaggedContent / totalScanned) * 100).toFixed(1) : '0'

    // Get daily trend data
    const dailyTrend = []
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = await prisma.spamDetection.count({
        where: {
          workspaceId,
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      })

      dailyTrend.push({
        date: date.toISOString().split('T')[0],
        count
      })
    }

    return NextResponse.json({
      statistics: {
        totalScanned,
        flaggedContent,
        autoRejected,
        pendingReview,
        effectivenessRate: parseFloat(effectivenessRate),
        period: `${periodDays} days`
      },
      filterBreakdown: filterByType,
      recentDetections,
      dailyTrend
    })

  } catch (error) {
    console.error('Failed to fetch content filtering statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}