import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Advanced spam detection algorithms
interface SpamAnalysisResult {
  isSpam: boolean
  confidence: number
  score: number
  reasons: string[]
  detectionType: string
  metadata: Record<string, any>
}

// Spam detection patterns and rules
const SPAM_PATTERNS = {
  // Common spam phrases
  phrases: [
    'make money fast', 'work from home', 'get rich quick', 'no experience required',
    'limited time offer', 'act now', 'urgent', 'guaranteed income', 'free trial',
    'click here now', 'visit our website', 'special promotion', 'exclusive deal',
    'earn $', 'make $', 'instant cash', 'work online', 'home business'
  ],

  // Suspicious patterns
  patterns: [
    /\b\d+\s*%\s*(off|discount|savings?)\b/gi, // Discount patterns
    /\$\d+(\.\d{2})?\s*(per|\/)\s*(hour|day|week|month)/gi, // Money per time
    /call\s*\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/gi, // Phone numbers
    /\b(viagra|cialis|pharmacy|pills?)\b/gi, // Pharmaceutical spam
    /\b(lottery|winner|prize|congratulations)\b/gi, // Lottery spam
    /\b(download|install|software|app)\b.*\b(free|crack|keygen)\b/gi // Software piracy
  ],

  // URL spam indicators
  urlIndicators: [
    'bit.ly', 'tinyurl', 'goo.gl', 't.co', 'short.link', 'tiny.cc',
    'ow.ly', 'buff.ly', 'is.gd', 'su.pr'
  ],

  // Repetitive content patterns
  repetition: {
    maxRepeatedChars: 5, // "!!!!!!" or "??????"
    maxRepeatedWords: 3, // "buy buy buy"
    maxCapsPercentage: 70 // 70% CAPS IS SPAM
  }
}

function analyzeSpamContent(content: string, userHistory?: any): SpamAnalysisResult {
  const result: SpamAnalysisResult = {
    isSpam: false,
    confidence: 0,
    score: 0,
    reasons: [],
    detectionType: 'CONTENT_ANALYSIS',
    metadata: {}
  }

  const lowercaseContent = content.toLowerCase()
  let score = 0
  const reasons: string[] = []

  // 1. Check for spam phrases
  let phraseMatches = 0
  SPAM_PATTERNS.phrases.forEach(phrase => {
    if (lowercaseContent.includes(phrase)) {
      phraseMatches++
      reasons.push(`Contains spam phrase: "${phrase}"`)
    }
  })
  score += phraseMatches * 15

  // 2. Check for suspicious patterns
  let patternMatches = 0
  SPAM_PATTERNS.patterns.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      patternMatches += matches.length
      reasons.push(`Suspicious pattern detected: ${matches[0]}`)
    }
  })
  score += patternMatches * 10

  // 3. Check for URL spam
  const urls = content.match(/https?:\/\/[^\s]+/gi) || []
  let suspiciousUrls = 0
  urls.forEach(url => {
    SPAM_PATTERNS.urlIndicators.forEach(indicator => {
      if (url.includes(indicator)) {
        suspiciousUrls++
        reasons.push(`Suspicious shortened URL: ${url}`)
      }
    })
  })
  score += suspiciousUrls * 20

  // 4. Check for excessive URLs
  if (urls.length > 3) {
    score += (urls.length - 3) * 10
    reasons.push(`Excessive number of URLs: ${urls.length}`)
  }

  // 5. Check for repetitive characters
  const repeatedChars = content.match(/(.)\1{4,}/g) || []
  if (repeatedChars.length > 0) {
    score += repeatedChars.length * 8
    reasons.push(`Repeated characters: ${repeatedChars.join(', ')}`)
  }

  // 6. Check for excessive capitals
  const capsCount = (content.match(/[A-Z]/g) || []).length
  const totalLetters = (content.match(/[A-Za-z]/g) || []).length
  const capsPercentage = totalLetters > 0 ? (capsCount / totalLetters) * 100 : 0

  if (capsPercentage > SPAM_PATTERNS.repetition.maxCapsPercentage) {
    score += 15
    reasons.push(`Excessive capitals: ${capsPercentage.toFixed(1)}%`)
  }

  // 7. Check for repeated words
  const words = content.toLowerCase().split(/\s+/)
  const wordCount: Record<string, number> = {}
  words.forEach(word => {
    if (word.length > 3) { // Only count meaningful words
      wordCount[word] = (wordCount[word] || 0) + 1
    }
  })

  Object.entries(wordCount).forEach(([word, count]) => {
    if (count > SPAM_PATTERNS.repetition.maxRepeatedWords) {
      score += (count - SPAM_PATTERNS.repetition.maxRepeatedWords) * 5
      reasons.push(`Repeated word: "${word}" (${count} times)`)
    }
  })

  // 8. Content length analysis
  if (content.length < 20 && urls.length > 0) {
    score += 10
    reasons.push('Very short content with URLs')
  }

  // 9. User history analysis (if provided)
  if (userHistory) {
    if (userHistory.recentPosts > 10 && userHistory.accountAge < 7) {
      score += 20
      reasons.push('High posting frequency from new account')
    }

    if (userHistory.violationCount > 2) {
      score += 15
      reasons.push('User has previous violations')
    }
  }

  // 10. Email/phone extraction spam
  const emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const phones = content.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || []

  if (emails.length > 1 || phones.length > 1) {
    score += 12
    reasons.push('Multiple contact details detected')
  }

  // Calculate final assessment
  result.score = Math.min(score, 100) // Cap at 100
  result.confidence = Math.min(score / 100, 0.95) // Max 95% confidence
  result.isSpam = score >= 40 // Threshold for spam classification
  result.reasons = reasons
  result.metadata = {
    phraseMatches,
    patternMatches,
    urlCount: urls.length,
    suspiciousUrls,
    capsPercentage: Math.round(capsPercentage),
    repeatedChars: repeatedChars.length,
    emailCount: emails.length,
    phoneCount: phones.length,
    contentLength: content.length,
    wordCount: words.length
  }

  return result
}

// POST /api/community/spam-detection - Analyze content for spam
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const {
      content,
      contentType = 'POST', // POST, REPLY, COMMENT
      targetId,
      userId,
      workspaceId,
      autoAction = false
    } = body

    // Validation
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Get user history for better analysis (if userId provided)
    let userHistory = null
    if (userId) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          _count: {
            select: {
              forumPosts: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                  ...(workspaceId && { workspaceId })
                }
              },
              moderationHistory: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                  ...(workspaceId && { workspaceId })
                }
              }
            }
          }
        }
      })

      if (user) {
        const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        userHistory = {
          accountAge,
          recentPosts: user._count.forumPosts,
          violationCount: user._count.moderationHistory
        }
      }
    }

    // Analyze content for spam
    const analysis = analyzeSpamContent(content, userHistory)

    // Store the detection result
    const detectionRecord = await prisma.spamDetection.create({
      data: {
        workspaceId: workspaceId || null,
        targetType: contentType,
        targetId: targetId || null,
        content: content.substring(0, 1000), // Store first 1000 chars
        detectionType: 'SPAM_ANALYSIS',
        confidence: analysis.confidence,
        reasons: analysis.reasons,
        metadata: {
          ...analysis.metadata,
          userHistory,
          analysisTimestamp: new Date().toISOString(),
          threshold: 40
        },
        status: analysis.isSpam ? 'CONFIRMED' : 'FALSE_POSITIVE',
        autoDetected: true
      }
    })

    // Auto-action if enabled and user has permissions
    if (autoAction && session?.user?.id && workspaceId && targetId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (userWorkspace && ['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        if (analysis.isSpam && analysis.confidence > 0.7) {
          // Auto-reject high-confidence spam
          await prisma.moderationAction.create({
            data: {
              workspaceId,
              moderatorId: null, // System action
              actionType: 'REJECT',
              targetType: contentType === 'POST' ? 'FORUM_POST' : 'FORUM_REPLY',
              targetId,
              reason: 'Automatically rejected as spam',
              description: `Spam detection confidence: ${(analysis.confidence * 100).toFixed(1)}%. Reasons: ${analysis.reasons.join(', ')}`,
              isAutomatic: true,
              status: 'COMPLETED',
              reviewedAt: new Date()
            }
          })

          // Update target content
          if (contentType === 'POST') {
            await prisma.communityForumPost.update({
              where: { id: targetId },
              data: { isApproved: false }
            })
          }
        } else if (analysis.isSpam && analysis.confidence > 0.4) {
          // Add to moderation queue for review
          await prisma.moderationQueue.create({
            data: {
              workspaceId,
              targetType: contentType === 'POST' ? 'FORUM_POST' : 'FORUM_REPLY',
              targetId,
              title: `Potential spam detected: ${content.substring(0, 50)}...`,
              priority: 'HIGH',
              status: 'PENDING',
              metadata: {
                spamAnalysis: analysis,
                autoFlagged: true,
                spamScore: analysis.score
              }
            }
          })
        }
      }
    }

    return NextResponse.json({
      analysis: {
        isSpam: analysis.isSpam,
        confidence: analysis.confidence,
        score: analysis.score,
        reasons: analysis.reasons
      },
      detectionId: detectionRecord.id,
      recommendation: analysis.isSpam ?
        (analysis.confidence > 0.7 ? 'REJECT' : 'REVIEW') : 'APPROVE'
    })

  } catch (error) {
    console.error('Failed to analyze spam content:', error)
    return NextResponse.json(
      { error: 'Failed to analyze content' },
      { status: 500 }
    )
  }
}

// GET /api/community/spam-detection - Get spam detection statistics and history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const period = searchParams.get('period') || '7' // days
    const status = searchParams.get('status') // CONFIRMED, PENDING, FALSE_POSITIVE
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

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

    // Build where clause
    const where: any = {
      ...(workspaceId && { workspaceId }),
      createdAt: { gte: startDate },
      detectionType: 'SPAM_ANALYSIS',
      ...(status && { status })
    }

    const [detections, totalCount, statistics] = await Promise.all([
      // Get spam detections
      prisma.spamDetection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          content: true,
          confidence: true,
          reasons: true,
          status: true,
          autoDetected: true,
          createdAt: true,
          metadata: true
        }
      }),

      // Total count
      prisma.spamDetection.count({ where }),

      // Get statistics
      Promise.all([
        prisma.spamDetection.count({
          where: { ...where, status: 'CONFIRMED' }
        }),
        prisma.spamDetection.count({
          where: { ...where, status: 'PENDING' }
        }),
        prisma.spamDetection.count({
          where: { ...where, status: 'FALSE_POSITIVE' }
        }),
        prisma.spamDetection.count({
          where: { ...where, autoDetected: true }
        })
      ])
    ])

    const [confirmedCount, pendingCount, falsePositiveCount, autoDetectedCount] = statistics

    // Get detection trend (daily for the period)
    const detectionTrend = []
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const [total, spam] = await Promise.all([
        prisma.spamDetection.count({
          where: {
            workspaceId,
            detectionType: 'SPAM_ANALYSIS',
            createdAt: { gte: date, lt: nextDate }
          }
        }),
        prisma.spamDetection.count({
          where: {
            workspaceId,
            detectionType: 'SPAM_ANALYSIS',
            status: 'CONFIRMED',
            createdAt: { gte: date, lt: nextDate }
          }
        })
      ])

      detectionTrend.push({
        date: date.toISOString().split('T')[0],
        total,
        spam
      })
    }

    // Calculate accuracy (confirmed + false positive) / total
    const accuracy = totalCount > 0 ?
      (((confirmedCount + falsePositiveCount) / totalCount) * 100).toFixed(1) : '0'

    return NextResponse.json({
      detections,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + detections.length < totalCount
      },
      statistics: {
        totalDetections: totalCount,
        confirmedSpam: confirmedCount,
        pendingReview: pendingCount,
        falsePositives: falsePositiveCount,
        autoDetected: autoDetectedCount,
        accuracy: parseFloat(accuracy),
        period: `${periodDays} days`
      },
      detectionTrend
    })

  } catch (error) {
    console.error('Failed to fetch spam detection data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spam detection data' },
      { status: 500 }
    )
  }
}