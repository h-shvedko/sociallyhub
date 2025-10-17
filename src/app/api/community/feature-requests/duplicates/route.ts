import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Duplicate detection algorithms
interface DuplicateMatch {
  requestId: string
  title: string
  description: string
  category: string
  status: string
  votes: number
  similarity: number
  matchReason: string[]
  createdAt: Date
}

interface SimilarityResult {
  targetRequest: any
  potentialDuplicates: DuplicateMatch[]
  confidence: number
  recommendedAction: 'MERGE' | 'REVIEW' | 'IGNORE'
}

// Simple text similarity function (in production, use more sophisticated NLP)
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/)
  const words2 = text2.toLowerCase().split(/\s+/)

  const commonWords = words1.filter(word => words2.includes(word))
  const totalWords = new Set([...words1, ...words2]).size

  return totalWords > 0 ? commonWords.length / totalWords : 0
}

function findKeywords(text: string): string[] {
  // Extract meaningful keywords (remove common words)
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must']

  return text.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word))
    .slice(0, 10) // Top 10 keywords
}

async function detectDuplicates(targetRequest: any, allRequests: any[]): Promise<DuplicateMatch[]> {
  const duplicates: DuplicateMatch[] = []
  const targetKeywords = findKeywords(targetRequest.title + ' ' + targetRequest.description)

  for (const request of allRequests) {
    if (request.id === targetRequest.id) continue

    const matchReasons: string[] = []
    let similarity = 0

    // 1. Title similarity
    const titleSimilarity = calculateTextSimilarity(targetRequest.title, request.title)
    if (titleSimilarity > 0.6) {
      similarity += titleSimilarity * 0.5
      matchReasons.push(`Title similarity: ${(titleSimilarity * 100).toFixed(1)}%`)
    }

    // 2. Description similarity
    const descSimilarity = calculateTextSimilarity(targetRequest.description, request.description)
    if (descSimilarity > 0.4) {
      similarity += descSimilarity * 0.3
      matchReasons.push(`Description similarity: ${(descSimilarity * 100).toFixed(1)}%`)
    }

    // 3. Keyword overlap
    const requestKeywords = findKeywords(request.title + ' ' + request.description)
    const keywordOverlap = targetKeywords.filter(kw => requestKeywords.includes(kw))
    if (keywordOverlap.length > 0) {
      const keywordSimilarity = keywordOverlap.length / Math.max(targetKeywords.length, requestKeywords.length)
      similarity += keywordSimilarity * 0.2
      matchReasons.push(`Common keywords: ${keywordOverlap.join(', ')}`)
    }

    // 4. Same category bonus
    if (targetRequest.category === request.category) {
      similarity += 0.1
      matchReasons.push('Same category')
    }

    // 5. Similar priority bonus
    if (targetRequest.priority === request.priority) {
      similarity += 0.05
      matchReasons.push('Same priority')
    }

    // Consider it a potential duplicate if similarity > 0.5
    if (similarity > 0.5 && matchReasons.length > 0) {
      duplicates.push({
        requestId: request.id,
        title: request.title,
        description: request.description,
        category: request.category,
        status: request.status,
        votes: request.votes,
        similarity: Math.min(similarity, 1), // Cap at 1.0
        matchReason: matchReasons,
        createdAt: request.createdAt
      })
    }
  }

  // Sort by similarity descending
  return duplicates.sort((a, b) => b.similarity - a.similarity)
}

// GET /api/community/feature-requests/duplicates - Detect potential duplicates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const requestId = searchParams.get('requestId')
    const autoDetect = searchParams.get('autoDetect') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has moderation permissions for duplicate detection
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

    // Get all feature requests for comparison
    const allRequests = await prisma.featureRequest.findMany({
      where: {
        workspaceId,
        status: { not: 'DUPLICATE' } // Don't include already marked duplicates
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        votes: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    if (requestId) {
      // Detect duplicates for a specific request
      const targetRequest = allRequests.find(req => req.id === requestId)
      if (!targetRequest) {
        return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
      }

      const potentialDuplicates = await detectDuplicates(targetRequest, allRequests)

      let confidence = 0
      let recommendedAction: 'MERGE' | 'REVIEW' | 'IGNORE' = 'IGNORE'

      if (potentialDuplicates.length > 0) {
        const maxSimilarity = potentialDuplicates[0].similarity
        confidence = maxSimilarity

        if (maxSimilarity > 0.8) {
          recommendedAction = 'MERGE'
        } else if (maxSimilarity > 0.6) {
          recommendedAction = 'REVIEW'
        }
      }

      return NextResponse.json({
        targetRequest,
        potentialDuplicates: potentialDuplicates.slice(0, 10), // Top 10 matches
        confidence,
        recommendedAction
      })
    }

    if (autoDetect) {
      // Auto-detect duplicates across all requests
      const duplicatePairs = []

      for (let i = 0; i < allRequests.length; i++) {
        const targetRequest = allRequests[i]
        const potentialDuplicates = await detectDuplicates(targetRequest, allRequests)

        // Only include high-confidence matches for auto-detection
        const highConfidenceMatches = potentialDuplicates.filter(dup => dup.similarity > 0.7)

        if (highConfidenceMatches.length > 0) {
          duplicatePairs.push({
            targetRequest,
            potentialDuplicates: highConfidenceMatches.slice(0, 3), // Top 3 matches
            confidence: highConfidenceMatches[0].similarity,
            recommendedAction: highConfidenceMatches[0].similarity > 0.8 ? 'MERGE' : 'REVIEW'
          })
        }
      }

      // Sort by confidence descending and limit results
      const sortedPairs = duplicatePairs
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20) // Top 20 duplicate groups

      return NextResponse.json({
        autoDetected: true,
        duplicateGroups: sortedPairs,
        totalGroups: sortedPairs.length,
        summary: {
          highConfidence: sortedPairs.filter(p => p.confidence > 0.8).length,
          mediumConfidence: sortedPairs.filter(p => p.confidence > 0.6 && p.confidence <= 0.8).length,
          lowConfidence: sortedPairs.filter(p => p.confidence <= 0.6).length
        }
      })
    }

    // Get duplicate statistics
    const [
      totalRequests,
      markedDuplicates,
      pendingReview
    ] = await Promise.all([
      allRequests.length,
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'DUPLICATE'
        }
      }),
      // Count requests that might need duplicate review (recent submissions)
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'PENDING',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ])

    return NextResponse.json({
      statistics: {
        totalRequests,
        markedDuplicates,
        pendingReview,
        duplicateRate: totalRequests > 0 ? ((markedDuplicates / totalRequests) * 100).toFixed(1) : '0'
      },
      recentRequests: allRequests
        .filter(req => req.status === 'PENDING')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
    })

  } catch (error) {
    console.error('Failed to detect duplicates:', error)
    return NextResponse.json(
      { error: 'Failed to detect duplicates' },
      { status: 500 }
    )
  }
}

// POST /api/community/feature-requests/duplicates - Merge duplicate requests
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      targetRequestId, // The request to keep
      duplicateRequestIds, // Array of requests to mark as duplicates
      reason,
      workspaceId,
      mergeVotes = true, // Whether to transfer votes to target
      mergeComments = false // Whether to transfer comments to target
    } = body

    // Validation
    if (!targetRequestId || !duplicateRequestIds || !Array.isArray(duplicateRequestIds) || duplicateRequestIds.length === 0) {
      return NextResponse.json(
        { error: 'Target request ID and duplicate request IDs are required' },
        { status: 400 }
      )
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has moderation permissions
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

    // Get all requests involved in the merge
    const allRequestIds = [targetRequestId, ...duplicateRequestIds]
    const requests = await prisma.featureRequest.findMany({
      where: {
        id: { in: allRequestIds },
        workspaceId
      },
      include: {
        votes: true,
        comments: true
      }
    })

    if (requests.length !== allRequestIds.length) {
      return NextResponse.json({ error: 'Some feature requests not found' }, { status: 404 })
    }

    const targetRequest = requests.find(req => req.id === targetRequestId)
    const duplicateRequests = requests.filter(req => duplicateRequestIds.includes(req.id))

    if (!targetRequest) {
      return NextResponse.json({ error: 'Target request not found' }, { status: 404 })
    }

    // Calculate merge statistics
    let totalVotesToMerge = 0
    let totalCommentsToMerge = 0

    if (mergeVotes) {
      totalVotesToMerge = duplicateRequests.reduce((sum, req) => sum + req.votes.length, 0)
    }

    if (mergeComments) {
      totalCommentsToMerge = duplicateRequests.reduce((sum, req) => sum + req.comments.length, 0)
    }

    // Perform the merge in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark duplicate requests as DUPLICATE and reference the target
      for (const duplicateRequest of duplicateRequests) {
        await tx.featureRequest.update({
          where: { id: duplicateRequest.id },
          data: {
            status: 'DUPLICATE',
            mergedInto: targetRequestId,
            moderatorNotes: reason || `Merged into ${targetRequest.title}`,
            archivedAt: new Date(),
            archivedBy: normalizeUserId(session.user.id)
          }
        })

        // Create moderation action for each duplicate
        await tx.moderationAction.create({
          data: {
            workspaceId,
            moderatorId: normalizeUserId(session.user.id),
            actionType: 'MERGE',
            targetType: 'FEATURE_REQUEST',
            targetId: duplicateRequest.id,
            reason: reason || `Merged duplicate into ${targetRequest.title}`,
            description: `Merged duplicate request: ${duplicateRequest.title}`,
            status: 'COMPLETED',
            reviewedBy: normalizeUserId(session.user.id),
            reviewedAt: new Date(),
            metadata: {
              mergedInto: targetRequestId,
              targetTitle: targetRequest.title,
              duplicateTitle: duplicateRequest.title
            }
          }
        })
      }

      // 2. Transfer votes if requested
      if (mergeVotes) {
        for (const duplicateRequest of duplicateRequests) {
          // Update vote count on target request
          await tx.featureRequest.update({
            where: { id: targetRequestId },
            data: {
              votes: {
                increment: duplicateRequest.votes.length
              }
            }
          })

          // Update individual vote records to point to target request
          await tx.featureRequestVote.updateMany({
            where: { requestId: duplicateRequest.id },
            data: {
              requestId: targetRequestId,
              mergedFrom: duplicateRequest.id
            }
          })
        }
      }

      // 3. Transfer comments if requested
      if (mergeComments) {
        for (const duplicateRequest of duplicateRequests) {
          await tx.featureRequestComment.updateMany({
            where: { requestId: duplicateRequest.id },
            data: {
              requestId: targetRequestId,
              mergedFrom: duplicateRequest.id
            }
          })

          // Update comment count on target request
          await tx.featureRequest.update({
            where: { id: targetRequestId },
            data: {
              commentsCount: {
                increment: duplicateRequest.comments.length
              }
            }
          })
        }
      }

      // 4. Get the updated target request
      const updatedTarget = await tx.featureRequest.findUnique({
        where: { id: targetRequestId },
        include: {
          votes: true,
          comments: true
        }
      })

      return updatedTarget
    })

    // Create community activities for the merge
    await prisma.communityActivity.create({
      data: {
        activityType: 'FEATURE_REQUEST_MERGED',
        title: 'Feature requests merged',
        description: `${duplicateRequests.length} duplicate request(s) merged into: ${targetRequest.title}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: targetRequestId,
        targetType: 'feature_request',
        targetTitle: targetRequest.title,
        workspaceId,
        metadata: {
          mergedRequestIds: duplicateRequestIds,
          mergedRequestTitles: duplicateRequests.map(req => req.title),
          votesTransferred: totalVotesToMerge,
          commentsTransferred: totalCommentsToMerge,
          reason,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      targetRequest: result,
      mergedRequests: duplicateRequests.length,
      votesTransferred: totalVotesToMerge,
      commentsTransferred: totalCommentsToMerge,
      message: `Successfully merged ${duplicateRequests.length} duplicate request(s)`
    })

  } catch (error) {
    console.error('Failed to merge duplicate requests:', error)
    return NextResponse.json(
      { error: 'Failed to merge duplicate requests' },
      { status: 500 }
    )
  }
}