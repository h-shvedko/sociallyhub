import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/categories - List all categories
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeStats = searchParams.get('includeStats') === 'true'

    // Base query
    const categories = await prisma.helpCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    // If stats are requested, get counts for each category
    if (includeStats) {
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const [articleCount, faqCount] = await Promise.all([
            prisma.helpArticle.count({
              where: {
                categoryId: category.id,
                status: 'published'
              }
            }),
            prisma.helpFAQ.count({
              where: {
                categoryId: category.id,
                isActive: true
              }
            })
          ])

          return {
            ...category,
            articleCount,
            faqCount,
            totalContent: articleCount + faqCount
          }
        })
      )

      return NextResponse.json(categoriesWithStats)
    }

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Failed to fetch help categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help categories' },
      { status: 500 }
    )
  }
}

// POST /api/help/categories - Create new category (Admin only)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const {
      name,
      slug,
      description,
      icon,
      sortOrder = 0,
      isActive = true
    } = data

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingCategory = await prisma.helpCategory.findUnique({
      where: { slug }
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this slug already exists' },
        { status: 400 }
      )
    }

    // Create the category
    const category = await prisma.helpCategory.create({
      data: {
        name,
        slug,
        description,
        icon,
        sortOrder,
        isActive
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Failed to create help category:', error)
    return NextResponse.json(
      { error: 'Failed to create help category' },
      { status: 500 }
    )
  }
}