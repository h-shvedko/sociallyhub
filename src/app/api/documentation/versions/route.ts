import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/versions - Get versions for a page
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    const versions = await prisma.documentationVersion.findMany({
      where: { pageId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const totalCount = await prisma.documentationVersion.count({
      where: { pageId }
    })

    return NextResponse.json({
      versions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Failed to fetch versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/versions - Create new version
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      pageId,
      version,
      title,
      content,
      changelog,
      isActive = false,
      autoVersion = true
    } = body

    if (!pageId || !title || !content) {
      return NextResponse.json(
        { error: 'Page ID, title, and content are required' },
        { status: 400 }
      )
    }

    // Verify page exists
    const page = await prisma.documentationPage.findUnique({
      where: { id: pageId },
      include: {
        versions: {
          where: { isActive: true },
          take: 1
        }
      }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Auto-generate version number if not provided
    let finalVersion = version
    if (autoVersion && !version) {
      const latestVersion = await prisma.documentationVersion.findFirst({
        where: { pageId },
        orderBy: { createdAt: 'desc' },
        select: { version: true }
      })

      if (latestVersion) {
        const versionParts = latestVersion.version.split('.').map(Number)
        if (versionParts.length === 3) {
          versionParts[1] += 1 // Increment minor version
          versionParts[2] = 0   // Reset patch version
          finalVersion = versionParts.join('.')
        } else {
          finalVersion = '1.1.0'
        }
      } else {
        finalVersion = '1.0.0'
      }
    }

    // Create version within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // If this is the new active version, deactivate the current one
      if (isActive && page.versions.length > 0) {
        await tx.documentationVersion.updateMany({
          where: {
            pageId,
            isActive: true
          },
          data: {
            isActive: false
          }
        })
      }

      // Create the new version
      const newVersion = await tx.documentationVersion.create({
        data: {
          pageId,
          version: finalVersion,
          title,
          content,
          changelog: changelog || 'No changelog provided',
          isActive,
          authorId: normalizedUserId
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // If this is the active version, update the page content
      if (isActive) {
        await tx.documentationPage.update({
          where: { id: pageId },
          data: {
            title,
            content,
            updatedAt: new Date()
          }
        })
      }

      return newVersion
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Failed to create version:', error)
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/versions/[id] - Update version
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
    const { version, title, content, changelog, isActive } = body

    // Check if version exists
    const existingVersion = await prisma.documentationVersion.findUnique({
      where: { id },
      include: { page: true }
    })

    if (!existingVersion) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Update within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // If setting as active, deactivate other versions
      if (isActive && !existingVersion.isActive) {
        await tx.documentationVersion.updateMany({
          where: {
            pageId: existingVersion.pageId,
            isActive: true
          },
          data: {
            isActive: false
          }
        })
      }

      // Update the version
      const updatedVersion = await tx.documentationVersion.update({
        where: { id },
        data: {
          ...(version && { version }),
          ...(title && { title }),
          ...(content && { content }),
          ...(changelog !== undefined && { changelog }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // If this version is now active, update the page content
      if (isActive && (title || content)) {
        await tx.documentationPage.update({
          where: { id: existingVersion.pageId },
          data: {
            ...(title && { title }),
            ...(content && { content }),
            updatedAt: new Date()
          }
        })
      }

      return updatedVersion
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to update version:', error)
    return NextResponse.json(
      { error: 'Failed to update version' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/versions/[id] - Delete version
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if version exists and is not active
    const existingVersion = await prisma.documentationVersion.findUnique({
      where: { id }
    })

    if (!existingVersion) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    if (existingVersion.isActive) {
      return NextResponse.json(
        { error: 'Cannot delete active version' },
        { status: 400 }
      )
    }

    await prisma.documentationVersion.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete version:', error)
    return NextResponse.json(
      { error: 'Failed to delete version' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/versions/[id]/activate - Activate version
export async function POST(request: NextRequest) {
  if (request.url.includes('/activate')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const id = pathParts[pathParts.length - 2] // Get version ID from URL

      // Check if version exists
      const version = await prisma.documentationVersion.findUnique({
        where: { id }
      })

      if (!version) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        )
      }

      if (version.isActive) {
        return NextResponse.json(
          { error: 'Version is already active' },
          { status: 400 }
        )
      }

      // Activate version within a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deactivate current active version
        await tx.documentationVersion.updateMany({
          where: {
            pageId: version.pageId,
            isActive: true
          },
          data: {
            isActive: false
          }
        })

        // Activate this version
        const activatedVersion = await tx.documentationVersion.update({
          where: { id },
          data: { isActive: true },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        })

        // Update page content to match this version
        await tx.documentationPage.update({
          where: { id: version.pageId },
          data: {
            title: version.title,
            content: version.content,
            updatedAt: new Date()
          }
        })

        return activatedVersion
      })

      return NextResponse.json(result)
    } catch (error) {
      console.error('Failed to activate version:', error)
      return NextResponse.json(
        { error: 'Failed to activate version' },
        { status: 500 }
      )
    }
  }
}

// POST /api/documentation/versions/[id]/restore - Restore version (create new version from old one)
export async function POST(request: NextRequest) {
  if (request.url.includes('/restore')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const normalizedUserId = normalizeUserId(session.user.id)
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const id = pathParts[pathParts.length - 2] // Get version ID from URL

      const body = await request.json()
      const { makeActive = false, changelog } = body

      // Get the version to restore
      const versionToRestore = await prisma.documentationVersion.findUnique({
        where: { id }
      })

      if (!versionToRestore) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        )
      }

      // Get the latest version to determine new version number
      const latestVersion = await prisma.documentationVersion.findFirst({
        where: { pageId: versionToRestore.pageId },
        orderBy: { createdAt: 'desc' },
        select: { version: true }
      })

      // Auto-increment version number
      let newVersionNumber = '1.0.0'
      if (latestVersion) {
        const versionParts = latestVersion.version.split('.').map(Number)
        if (versionParts.length === 3) {
          versionParts[1] += 1 // Increment minor version
          versionParts[2] = 0   // Reset patch version
          newVersionNumber = versionParts.join('.')
        }
      }

      // Create new version within a transaction
      const result = await prisma.$transaction(async (tx) => {
        // If making active, deactivate current active version
        if (makeActive) {
          await tx.documentationVersion.updateMany({
            where: {
              pageId: versionToRestore.pageId,
              isActive: true
            },
            data: {
              isActive: false
            }
          })
        }

        // Create new version with content from the old version
        const restoredVersion = await tx.documentationVersion.create({
          data: {
            pageId: versionToRestore.pageId,
            version: newVersionNumber,
            title: versionToRestore.title,
            content: versionToRestore.content,
            changelog: changelog || `Restored from version ${versionToRestore.version}`,
            isActive: makeActive,
            authorId: normalizedUserId
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        })

        // If making active, update page content
        if (makeActive) {
          await tx.documentationPage.update({
            where: { id: versionToRestore.pageId },
            data: {
              title: versionToRestore.title,
              content: versionToRestore.content,
              updatedAt: new Date()
            }
          })
        }

        return restoredVersion
      })

      return NextResponse.json(result, { status: 201 })
    } catch (error) {
      console.error('Failed to restore version:', error)
      return NextResponse.json(
        { error: 'Failed to restore version' },
        { status: 500 }
      )
    }
  }
}

// GET /api/documentation/versions/[id]/compare - Compare two versions
export async function GET(request: NextRequest) {
  if (request.url.includes('/compare')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const id = pathParts[pathParts.length - 2] // Get version ID from URL
      const searchParams = url.searchParams
      const compareWithId = searchParams.get('with')

      if (!compareWithId) {
        return NextResponse.json(
          { error: 'Comparison version ID is required' },
          { status: 400 }
        )
      }

      // Get both versions
      const [version1, version2] = await Promise.all([
        prisma.documentationVersion.findUnique({
          where: { id },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }),
        prisma.documentationVersion.findUnique({
          where: { id: compareWithId },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        })
      ])

      if (!version1 || !version2) {
        return NextResponse.json(
          { error: 'One or both versions not found' },
          { status: 404 }
        )
      }

      if (version1.pageId !== version2.pageId) {
        return NextResponse.json(
          { error: 'Versions must belong to the same page' },
          { status: 400 }
        )
      }

      // Simple diff calculation (in real implementation, use a proper diff library)
      const differences = {
        title: {
          changed: version1.title !== version2.title,
          from: version2.title,
          to: version1.title
        },
        content: {
          changed: version1.content !== version2.content,
          from: version2.content,
          to: version1.content,
          // Simple character difference count
          additions: Math.max(0, version1.content.length - version2.content.length),
          deletions: Math.max(0, version2.content.length - version1.content.length)
        },
        metadata: {
          version1: {
            id: version1.id,
            version: version1.version,
            createdAt: version1.createdAt,
            author: version1.author
          },
          version2: {
            id: version2.id,
            version: version2.version,
            createdAt: version2.createdAt,
            author: version2.author
          }
        }
      }

      return NextResponse.json(differences)
    } catch (error) {
      console.error('Failed to compare versions:', error)
      return NextResponse.json(
        { error: 'Failed to compare versions' },
        { status: 500 }
      )
    }
  }
}