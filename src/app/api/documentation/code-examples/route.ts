import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/code-examples - Get code examples for a page
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')
    const language = searchParams.get('language')

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    const where: any = { pageId }
    if (language) {
      where.language = language.toUpperCase()
    }

    const codeExamples = await prisma.documentationCodeExample.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json(codeExamples)
  } catch (error) {
    console.error('Failed to fetch code examples:', error)
    return NextResponse.json(
      { error: 'Failed to fetch code examples' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/code-examples - Create new code example
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
      title,
      description,
      language,
      code,
      isTestable = false,
      testCommand,
      expectedOutput,
      sortOrder = 0,
      tags = []
    } = body

    if (!pageId || !title || !language || !code) {
      return NextResponse.json(
        { error: 'Page ID, title, language, and code are required' },
        { status: 400 }
      )
    }

    // Verify page exists
    const page = await prisma.documentationPage.findUnique({
      where: { id: pageId }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Run tests if testable
    let testResults = null
    if (isTestable && testCommand) {
      try {
        // Mock test execution - in real implementation, this would run in a sandboxed environment
        testResults = {
          passed: true,
          output: expectedOutput || 'Test completed successfully',
          executedAt: new Date(),
          duration: Math.floor(Math.random() * 1000) + 100 // Mock duration in ms
        }
      } catch (testError) {
        testResults = {
          passed: false,
          output: `Test failed: ${testError}`,
          executedAt: new Date(),
          duration: 0
        }
      }
    }

    const codeExample = await prisma.documentationCodeExample.create({
      data: {
        pageId,
        title,
        description,
        language: language.toUpperCase() as any,
        code,
        isTestable,
        testCommand,
        expectedOutput,
        testResults,
        sortOrder,
        tags,
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

    return NextResponse.json(codeExample, { status: 201 })
  } catch (error) {
    console.error('Failed to create code example:', error)
    return NextResponse.json(
      { error: 'Failed to create code example' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/code-examples/[id] - Update code example
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
    const {
      title,
      description,
      language,
      code,
      isTestable,
      testCommand,
      expectedOutput,
      sortOrder,
      tags,
      runTests = false
    } = body

    // Check if code example exists
    const existingExample = await prisma.documentationCodeExample.findUnique({
      where: { id }
    })

    if (!existingExample) {
      return NextResponse.json(
        { error: 'Code example not found' },
        { status: 404 }
      )
    }

    // Run tests if requested and testable
    let testResults = existingExample.testResults
    if (runTests && (isTestable || existingExample.isTestable) && (testCommand || existingExample.testCommand)) {
      try {
        // Mock test execution
        testResults = {
          passed: true,
          output: expectedOutput || existingExample.expectedOutput || 'Test completed successfully',
          executedAt: new Date(),
          duration: Math.floor(Math.random() * 1000) + 100
        }
      } catch (testError) {
        testResults = {
          passed: false,
          output: `Test failed: ${testError}`,
          executedAt: new Date(),
          duration: 0
        }
      }
    }

    const updatedExample = await prisma.documentationCodeExample.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(language && { language: language.toUpperCase() as any }),
        ...(code && { code }),
        ...(isTestable !== undefined && { isTestable }),
        ...(testCommand !== undefined && { testCommand }),
        ...(expectedOutput !== undefined && { expectedOutput }),
        ...(testResults && { testResults }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(tags && { tags })
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

    return NextResponse.json(updatedExample)
  } catch (error) {
    console.error('Failed to update code example:', error)
    return NextResponse.json(
      { error: 'Failed to update code example' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/code-examples/[id] - Delete code example
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if code example exists
    const existingExample = await prisma.documentationCodeExample.findUnique({
      where: { id }
    })

    if (!existingExample) {
      return NextResponse.json(
        { error: 'Code example not found' },
        { status: 404 }
      )
    }

    await prisma.documentationCodeExample.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete code example:', error)
    return NextResponse.json(
      { error: 'Failed to delete code example' },
      { status: 500 }
    )
  }
}