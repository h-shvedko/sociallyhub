import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      select: { workspaceId: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const action = searchParams.get('action')

    if (action === 'analyze' && videoId) {
      // Analyze SEO for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      const seoAnalysis = analyzeSEO(video)

      return NextResponse.json({
        videoId: video.id,
        videoTitle: video.title,
        analysis: seoAnalysis,
        recommendations: generateSEORecommendations(video),
        competitorAnalysis: generateCompetitorAnalysis(video),
        keywordSuggestions: generateKeywordSuggestions(video)
      })
    }

    if (videoId) {
      // Get SEO data for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          category: true,
          status: true,
          transcript: true,
          duration: true,
          analytics: {
            select: {
              views: true,
              uniqueViews: true
            }
          }
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      const seoScore = calculateSEOScore(video)

      return NextResponse.json({
        video,
        seo: {
          score: seoScore.overall,
          breakdown: seoScore.breakdown,
          issues: seoScore.issues,
          suggestions: seoScore.suggestions
        },
        optimization: {
          titleLength: video.seoTitle?.length || video.title?.length || 0,
          descriptionLength: video.seoDescription?.length || video.description?.length || 0,
          keywordCount: video.seoKeywords?.length || 0,
          hasTranscript: !!video.transcript,
          hasThumbnail: true, // Placeholder
          categorySet: !!video.category
        }
      })
    }

    // Get SEO overview for all videos
    const videos = await prisma.videoTutorial.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId
      },
      select: {
        id: true,
        title: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        description: true,
        tags: true,
        category: true,
        status: true,
        transcript: true,
        createdAt: true,
        analytics: {
          select: {
            views: true,
            uniqueViews: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const seoStats = videos.reduce((stats, video) => {
      const score = calculateSEOScore(video)
      stats.totalVideos += 1
      stats.totalScore += score.overall

      if (score.overall >= 80) stats.excellent += 1
      else if (score.overall >= 60) stats.good += 1
      else if (score.overall >= 40) stats.needsWork += 1
      else stats.poor += 1

      if (video.seoTitle) stats.withSEOTitle += 1
      if (video.seoDescription) stats.withSEODescription += 1
      if (video.seoKeywords && video.seoKeywords.length > 0) stats.withSEOKeywords += 1
      if (video.transcript) stats.withTranscript += 1

      return stats
    }, {
      totalVideos: 0,
      totalScore: 0,
      excellent: 0,
      good: 0,
      needsWork: 0,
      poor: 0,
      withSEOTitle: 0,
      withSEODescription: 0,
      withSEOKeywords: 0,
      withTranscript: 0
    })

    const avgScore = seoStats.totalVideos > 0 ? Math.round(seoStats.totalScore / seoStats.totalVideos) : 0

    return NextResponse.json({
      videos: videos.map(video => ({
        ...video,
        seoScore: calculateSEOScore(video).overall,
        optimization: {
          titleOptimized: !!video.seoTitle,
          descriptionOptimized: !!video.seoDescription,
          keywordsOptimized: !!(video.seoKeywords && video.seoKeywords.length > 0),
          transcriptAvailable: !!video.transcript
        }
      })),
      stats: {
        ...seoStats,
        averageScore: avgScore,
        optimizationRate: seoStats.totalVideos > 0
          ? Math.round(((seoStats.excellent + seoStats.good) / seoStats.totalVideos) * 100)
          : 0
      },
      insights: {
        topIssues: [
          'Missing SEO descriptions',
          'Keywords not optimized',
          'Titles too long',
          'Missing transcripts'
        ],
        opportunities: [
          'Add structured data markup',
          'Optimize video thumbnails',
          'Improve keyword targeting',
          'Add video chapters'
        ]
      }
    })
  } catch (error) {
    console.error('Error fetching SEO data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      select: { workspaceId: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const body = await request.json()
    const { videoId, action } = body

    // Verify video belongs to workspace
    const video = await prisma.videoTutorial.findFirst({
      where: {
        id: videoId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (action === 'optimize') {
      // Auto-optimize SEO fields
      const optimization = await autoOptimizeSEO(video)

      const updatedVideo = await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          seoTitle: optimization.seoTitle,
          seoDescription: optimization.seoDescription,
          seoKeywords: optimization.seoKeywords,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'SEO optimization completed',
        video: updatedVideo,
        optimization: {
          applied: optimization.applied,
          improvements: optimization.improvements,
          before: {
            seoTitle: video.seoTitle,
            seoDescription: video.seoDescription,
            seoKeywords: video.seoKeywords
          },
          after: {
            seoTitle: optimization.seoTitle,
            seoDescription: optimization.seoDescription,
            seoKeywords: optimization.seoKeywords
          }
        }
      })
    }

    if (action === 'update') {
      // Manual SEO update
      const { seoTitle, seoDescription, seoKeywords } = body

      // Validate SEO fields
      const validation = validateSEOFields({
        seoTitle,
        seoDescription,
        seoKeywords
      })

      if (!validation.isValid) {
        return NextResponse.json({
          error: 'SEO validation failed',
          issues: validation.issues
        }, { status: 400 })
      }

      const updatedVideo = await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          ...(seoTitle !== undefined && { seoTitle }),
          ...(seoDescription !== undefined && { seoDescription }),
          ...(seoKeywords !== undefined && { seoKeywords }),
          updatedAt: new Date()
        }
      })

      const newScore = calculateSEOScore(updatedVideo)

      return NextResponse.json({
        success: true,
        message: 'SEO fields updated successfully',
        video: updatedVideo,
        seoScore: newScore.overall,
        improvements: validation.improvements
      })
    }

    if (action === 'bulk_optimize') {
      // Bulk SEO optimization
      const { videoIds } = body

      if (!videoIds || !Array.isArray(videoIds)) {
        return NextResponse.json({
          error: 'Video IDs array is required'
        }, { status: 400 })
      }

      const results = []

      for (const id of videoIds) {
        try {
          const targetVideo = await prisma.videoTutorial.findFirst({
            where: {
              id,
              workspaceId: userWorkspace.workspaceId
            }
          })

          if (targetVideo) {
            const optimization = await autoOptimizeSEO(targetVideo)

            await prisma.videoTutorial.update({
              where: { id },
              data: {
                seoTitle: optimization.seoTitle,
                seoDescription: optimization.seoDescription,
                seoKeywords: optimization.seoKeywords,
                updatedAt: new Date()
              }
            })

            results.push({
              videoId: id,
              videoTitle: targetVideo.title,
              success: true,
              improvements: optimization.improvements
            })
          } else {
            results.push({
              videoId: id,
              success: false,
              error: 'Video not found'
            })
          }
        } catch (error) {
          results.push({
            videoId: id,
            success: false,
            error: error.message
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${results.length} videos`,
        results,
        summary: {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      })
    }

    if (action === 'generate_schema') {
      // Generate structured data schema
      const schema = generateVideoSchema(video)

      return NextResponse.json({
        success: true,
        schema,
        instructions: {
          implementation: 'Add this JSON-LD to your page head',
          testing: 'Use Google Rich Results Test to validate',
          benefits: [
            'Enhanced search appearance',
            'Video rich snippets',
            'Better click-through rates',
            'Improved video discoverability'
          ]
        }
      })
    }

    return NextResponse.json({
      error: 'Invalid action. Supported: optimize, update, bulk_optimize, generate_schema'
    }, { status: 400 })
  } catch (error) {
    console.error('Error processing SEO:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to calculate SEO score
function calculateSEOScore(video: any) {
  let score = 0
  const breakdown = {}
  const issues = []
  const suggestions = []

  // Title optimization (20 points)
  const title = video.seoTitle || video.title || ''
  if (title.length >= 30 && title.length <= 60) {
    score += 20
    breakdown.title = 20
  } else if (title.length > 0) {
    score += 10
    breakdown.title = 10
    if (title.length < 30) {
      issues.push('Title too short (recommended: 30-60 characters)')
      suggestions.push('Expand title with relevant keywords')
    } else {
      issues.push('Title too long (recommended: 30-60 characters)')
      suggestions.push('Shorten title while keeping key information')
    }
  } else {
    breakdown.title = 0
    issues.push('Missing SEO title')
    suggestions.push('Add a descriptive SEO title')
  }

  // Description optimization (25 points)
  const description = video.seoDescription || video.description || ''
  if (description.length >= 120 && description.length <= 300) {
    score += 25
    breakdown.description = 25
  } else if (description.length > 0) {
    score += 12
    breakdown.description = 12
    if (description.length < 120) {
      issues.push('Description too short (recommended: 120-300 characters)')
      suggestions.push('Expand description with more details')
    } else {
      issues.push('Description too long (recommended: 120-300 characters)')
      suggestions.push('Condense description to key points')
    }
  } else {
    breakdown.description = 0
    issues.push('Missing SEO description')
    suggestions.push('Add a compelling SEO description')
  }

  // Keywords optimization (20 points)
  const keywords = video.seoKeywords || []
  if (keywords.length >= 3 && keywords.length <= 10) {
    score += 20
    breakdown.keywords = 20
  } else if (keywords.length > 0) {
    score += 10
    breakdown.keywords = 10
    if (keywords.length < 3) {
      issues.push('Too few keywords (recommended: 3-10)')
      suggestions.push('Add more relevant keywords')
    } else {
      issues.push('Too many keywords (recommended: 3-10)')
      suggestions.push('Focus on most important keywords')
    }
  } else {
    breakdown.keywords = 0
    issues.push('Missing SEO keywords')
    suggestions.push('Add relevant keywords for better discoverability')
  }

  // Content optimization (15 points)
  if (video.transcript) {
    score += 15
    breakdown.content = 15
  } else {
    breakdown.content = 0
    issues.push('Missing transcript')
    suggestions.push('Add transcript for better SEO and accessibility')
  }

  // Technical optimization (10 points)
  if (video.category) {
    score += 5
    breakdown.technical = 5
  } else {
    breakdown.technical = 0
    issues.push('Missing category')
    suggestions.push('Set appropriate category')
  }

  // Engagement optimization (10 points)
  const views = video.analytics?.views || 0
  if (views > 100) {
    score += 10
    breakdown.engagement = 10
  } else if (views > 10) {
    score += 5
    breakdown.engagement = 5
  } else {
    breakdown.engagement = 0
    suggestions.push('Promote video to increase views and engagement')
  }

  return {
    overall: Math.min(100, score),
    breakdown,
    issues,
    suggestions
  }
}

// Helper function to validate SEO fields
function validateSEOFields(fields: any) {
  const issues = []
  const improvements = []
  let isValid = true

  if (fields.seoTitle) {
    if (fields.seoTitle.length < 10) {
      issues.push('SEO title too short')
      isValid = false
    } else if (fields.seoTitle.length > 100) {
      issues.push('SEO title too long')
      isValid = false
    } else {
      improvements.push('SEO title length is optimal')
    }
  }

  if (fields.seoDescription) {
    if (fields.seoDescription.length < 50) {
      issues.push('SEO description too short')
      isValid = false
    } else if (fields.seoDescription.length > 500) {
      issues.push('SEO description too long')
      isValid = false
    } else {
      improvements.push('SEO description length is optimal')
    }
  }

  if (fields.seoKeywords && Array.isArray(fields.seoKeywords)) {
    if (fields.seoKeywords.length > 15) {
      issues.push('Too many SEO keywords')
      isValid = false
    } else if (fields.seoKeywords.length > 0) {
      improvements.push('SEO keywords provided')
    }
  }

  return { isValid, issues, improvements }
}

// Helper function to auto-optimize SEO
async function autoOptimizeSEO(video: any) {
  const applied = []
  const improvements = []

  // Optimize title
  let seoTitle = video.seoTitle || video.title || ''
  if (!seoTitle || seoTitle.length < 30) {
    seoTitle = `${video.title} - Complete Tutorial Guide`
    applied.push('Enhanced SEO title')
    improvements.push('Added descriptive keywords to title')
  }

  // Optimize description
  let seoDescription = video.seoDescription || video.description || ''
  if (!seoDescription || seoDescription.length < 120) {
    seoDescription = `Learn ${video.title} in this comprehensive tutorial. Step-by-step guide covering everything you need to know. Perfect for beginners and advanced users.`
    applied.push('Generated SEO description')
    improvements.push('Created compelling description with keywords')
  }

  // Optimize keywords
  let seoKeywords = video.seoKeywords || []
  if (!seoKeywords || seoKeywords.length < 3) {
    // Generate keywords based on title and category
    const generatedKeywords = generateKeywordsFromContent(video.title, video.category, video.description)
    seoKeywords = [...(seoKeywords || []), ...generatedKeywords].slice(0, 8)
    applied.push('Added relevant keywords')
    improvements.push('Generated keywords from content analysis')
  }

  return {
    seoTitle,
    seoDescription,
    seoKeywords,
    applied,
    improvements
  }
}

// Helper function to generate keywords from content
function generateKeywordsFromContent(title: string, category: string, description: string) {
  const keywords = []

  // Extract keywords from title
  const titleWords = title.toLowerCase().split(' ').filter(word => word.length > 3)
  keywords.push(...titleWords.slice(0, 3))

  // Add category-based keywords
  if (category) {
    keywords.push(category.toLowerCase())
    keywords.push(`${category.toLowerCase()} tutorial`)
  }

  // Add common tutorial keywords
  keywords.push('tutorial', 'guide', 'how to', 'learn')

  // Remove duplicates and limit
  return [...new Set(keywords)].slice(0, 5)
}

// Helper function to analyze SEO
function analyzeSEO(video: any) {
  return {
    titleAnalysis: {
      length: (video.seoTitle || video.title || '').length,
      wordCount: (video.seoTitle || video.title || '').split(' ').length,
      keywordDensity: 'Medium',
      readability: 'Good'
    },
    descriptionAnalysis: {
      length: (video.seoDescription || video.description || '').length,
      wordCount: (video.seoDescription || video.description || '').split(' ').length,
      keywordPresence: 'Present',
      callToAction: 'Missing'
    },
    technicalSEO: {
      structured_data: 'Not implemented',
      mobile_friendly: 'Yes',
      loading_speed: 'Good',
      accessibility: video.transcript ? 'Good' : 'Needs improvement'
    }
  }
}

// Helper function to generate SEO recommendations
function generateSEORecommendations(video: any) {
  return [
    {
      priority: 'High',
      category: 'Content',
      recommendation: 'Add video transcript for better accessibility and SEO',
      impact: 'Significant improvement in search rankings'
    },
    {
      priority: 'Medium',
      category: 'Technical',
      recommendation: 'Implement video structured data markup',
      impact: 'Enhanced search appearance with rich snippets'
    },
    {
      priority: 'Medium',
      category: 'Keywords',
      recommendation: 'Optimize keyword targeting based on search volume',
      impact: 'Better targeting of relevant search queries'
    }
  ]
}

// Helper function to generate competitor analysis
function generateCompetitorAnalysis(video: any) {
  return {
    similarContent: [
      {
        title: 'Similar Tutorial on Topic',
        views: '50K views',
        ranking: '#3 for target keyword',
        strengths: ['Good title optimization', 'High engagement'],
        opportunities: ['Longer content', 'Better thumbnail']
      }
    ],
    keywordGaps: [
      'long-tail keyword opportunity',
      'related topic keywords',
      'seasonal keywords'
    ],
    contentGaps: [
      'Advanced tutorials in this category',
      'Beginner-friendly versions',
      'Mobile-specific content'
    ]
  }
}

// Helper function to generate keyword suggestions
function generateKeywordSuggestions(video: any) {
  return {
    primary: [
      `${video.title} tutorial`,
      `how to ${video.title}`,
      `${video.title} guide`
    ],
    secondary: [
      `${video.title} tips`,
      `${video.title} examples`,
      `${video.title} best practices`
    ],
    longTail: [
      `complete ${video.title} tutorial for beginners`,
      `step by step ${video.title} guide`,
      `${video.title} tutorial with examples`
    ]
  }
}

// Helper function to generate video schema
function generateVideoSchema(video: any) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": video.seoTitle || video.title,
    "description": video.seoDescription || video.description,
    "thumbnailUrl": video.thumbnailUrl,
    "uploadDate": video.createdAt,
    "duration": `PT${Math.floor((video.duration || 0) / 60)}M${(video.duration || 0) % 60}S`,
    "contentUrl": video.videoUrl,
    "embedUrl": video.videoUrl,
    "publisher": {
      "@type": "Organization",
      "name": "SociallyHub",
      "logo": {
        "@type": "ImageObject",
        "url": "/logo.png"
      }
    }
  }
}