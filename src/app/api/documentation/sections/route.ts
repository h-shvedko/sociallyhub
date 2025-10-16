import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/documentation/sections - Get all documentation sections
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeStats = searchParams.get('includeStats') === 'true'

    const sections = await prisma.documentationSection.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        ...(includeStats && {
          pages: {
            select: {
              id: true,
              status: true
            },
            where: {
              status: 'published'
            }
          }
        })
      },
      orderBy: {
        sortOrder: 'asc'
      }
    })

    // Add page counts if requested
    const sectionsWithStats = includeStats
      ? sections.map(section => ({
          ...section,
          pageCount: (section as any).pages?.length || 0,
          pages: undefined // Remove the pages array after counting
        }))
      : sections

    return NextResponse.json(sectionsWithStats)
  } catch (error) {
    console.error('Failed to fetch documentation sections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation sections' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/sections - Create new documentation section
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, slug, description, icon, sortOrder = 0 } = body

    if (!title || !slug) {
      return NextResponse.json(
        { error: 'Title and slug are required' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingSection = await prisma.documentationSection.findUnique({
      where: { slug }
    })

    if (existingSection) {
      return NextResponse.json(
        { error: 'Section with this slug already exists' },
        { status: 409 }
      )
    }

    const section = await prisma.documentationSection.create({
      data: {
        title,
        slug,
        description,
        icon,
        sortOrder
      }
    })

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('Failed to create documentation section:', error)
    return NextResponse.json(
      { error: 'Failed to create documentation section' },
      { status: 500 }
    )
  }
}