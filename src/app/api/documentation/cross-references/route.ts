import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/cross-references - Get cross-references for a page
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')
    const type = searchParams.get('type') // 'outgoing' | 'incoming' | 'all'

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    let crossReferences: any[] = []

    if (type === 'outgoing' || type === 'all' || !type) {
      // Get references FROM this page TO other pages
      const outgoing = await prisma.documentationCrossReference.findMany({
        where: { pageId },
        include: {
          referencedPage: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              section: {
                select: {
                  title: true,
                  slug: true
                }
              }
            }
          }
        }
      })

      crossReferences.push(...outgoing.map(ref => ({
        ...ref,
        type: 'outgoing'
      })))
    }

    if (type === 'incoming' || type === 'all' || !type) {
      // Get references TO this page FROM other pages
      const incoming = await prisma.documentationCrossReference.findMany({
        where: { referencedPageId: pageId },
        include: {
          page: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              section: {
                select: {
                  title: true,
                  slug: true
                }
              }
            }
          }
        }
      })

      crossReferences.push(...incoming.map(ref => ({
        ...ref,
        type: 'incoming'
      })))
    }

    return NextResponse.json(crossReferences)
  } catch (error) {
    console.error('Failed to fetch cross-references:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cross-references' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/cross-references - Create new cross-reference
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pageId, referencedPageId, context, anchor, linkText } = body

    if (!pageId || !referencedPageId) {
      return NextResponse.json(
        { error: 'Page ID and referenced page ID are required' },
        { status: 400 }
      )
    }

    // Verify both pages exist
    const [page, referencedPage] = await Promise.all([
      prisma.documentationPage.findUnique({ where: { id: pageId } }),
      prisma.documentationPage.findUnique({ where: { id: referencedPageId } })
    ])

    if (!page) {
      return NextResponse.json(
        { error: 'Source page not found' },
        { status: 404 }
      )
    }

    if (!referencedPage) {
      return NextResponse.json(
        { error: 'Referenced page not found' },
        { status: 404 }
      )
    }

    // Check if cross-reference already exists
    const existingRef = await prisma.documentationCrossReference.findUnique({
      where: {
        pageId_referencedPageId_context: {
          pageId,
          referencedPageId,
          context: context || ''
        }
      }
    })

    if (existingRef) {
      return NextResponse.json(
        { error: 'Cross-reference already exists' },
        { status: 409 }
      )
    }

    const crossReference = await prisma.documentationCrossReference.create({
      data: {
        pageId,
        referencedPageId,
        context,
        anchor,
        linkText
      },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        referencedPage: {
          select: {
            id: true,
            title: true,
            slug: true,
            section: {
              select: {
                title: true,
                slug: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(crossReference, { status: 201 })
  } catch (error) {
    console.error('Failed to create cross-reference:', error)
    return NextResponse.json(
      { error: 'Failed to create cross-reference' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/cross-references/[id] - Update cross-reference
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    const body = await request.json()
    const { context, anchor, linkText } = body

    // Check if cross-reference exists
    const existingRef = await prisma.documentationCrossReference.findUnique({
      where: { id }
    })

    if (!existingRef) {
      return NextResponse.json(
        { error: 'Cross-reference not found' },
        { status: 404 }
      )
    }

    const updatedRef = await prisma.documentationCrossReference.update({
      where: { id },
      data: {
        ...(context !== undefined && { context }),
        ...(anchor !== undefined && { anchor }),
        ...(linkText !== undefined && { linkText })
      },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        referencedPage: {
          select: {
            id: true,
            title: true,
            slug: true,
            section: {
              select: {
                title: true,
                slug: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedRef)
  } catch (error) {
    console.error('Failed to update cross-reference:', error)
    return NextResponse.json(
      { error: 'Failed to update cross-reference' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/cross-references/[id] - Delete cross-reference
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if cross-reference exists
    const existingRef = await prisma.documentationCrossReference.findUnique({
      where: { id }
    })

    if (!existingRef) {
      return NextResponse.json(
        { error: 'Cross-reference not found' },
        { status: 404 }
      )
    }

    await prisma.documentationCrossReference.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete cross-reference:', error)
    return NextResponse.json(
      { error: 'Failed to delete cross-reference' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/cross-references/auto-detect - Auto-detect potential cross-references
export async function POST(request: NextRequest) {
  if (request.url.includes('/auto-detect')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await request.json()
      const { pageId, content } = body

      if (!pageId || !content) {
        return NextResponse.json(
          { error: 'Page ID and content are required' },
          { status: 400 }
        )
      }

      // Get all other pages to check for potential references
      const allPages = await prisma.documentationPage.findMany({
        where: {
          id: { not: pageId },
          status: { in: ['PUBLISHED', 'REVIEW'] }
        },
        select: {
          id: true,
          title: true,
          slug: true,
          tags: true,
          section: {
            select: {
              title: true,
              slug: true
            }
          }
        }
      })

      const suggestions: any[] = []

      // Simple text matching algorithm
      // In a real implementation, this could use NLP or more sophisticated matching
      allPages.forEach(page => {
        const matches: any[] = []

        // Check for title mentions
        const titleRegex = new RegExp(`\\b${escapeRegExp(page.title)}\\b`, 'gi')
        const titleMatches = content.match(titleRegex)
        if (titleMatches) {
          matches.push({
            type: 'title',
            text: page.title,
            matches: titleMatches.length
          })
        }

        // Check for slug mentions
        const slugRegex = new RegExp(`\\b${escapeRegExp(page.slug)}\\b`, 'gi')
        const slugMatches = content.match(slugRegex)
        if (slugMatches) {
          matches.push({
            type: 'slug',
            text: page.slug,
            matches: slugMatches.length
          })
        }

        // Check for tag mentions
        page.tags?.forEach(tag => {
          const tagRegex = new RegExp(`\\b${escapeRegExp(tag)}\\b`, 'gi')
          const tagMatches = content.match(tagRegex)
          if (tagMatches) {
            matches.push({
              type: 'tag',
              text: tag,
              matches: tagMatches.length
            })
          }
        })

        // Check for section mentions
        const sectionRegex = new RegExp(`\\b${escapeRegExp(page.section.title)}\\b`, 'gi')
        const sectionMatches = content.match(sectionRegex)
        if (sectionMatches) {
          matches.push({
            type: 'section',
            text: page.section.title,
            matches: sectionMatches.length
          })
        }

        if (matches.length > 0) {
          const totalScore = matches.reduce((sum, match) => sum + match.matches, 0)
          suggestions.push({
            page,
            matches,
            score: totalScore,
            confidence: Math.min(totalScore * 0.2, 1) // Simple confidence scoring
          })
        }
      })

      // Sort by score and return top suggestions
      const topSuggestions = suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

      return NextResponse.json({
        suggestions: topSuggestions,
        totalFound: suggestions.length
      })
    } catch (error) {
      console.error('Failed to auto-detect cross-references:', error)
      return NextResponse.json(
        { error: 'Failed to auto-detect cross-references' },
        { status: 500 }
      )
    }
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}