import { NextRequest, NextResponse } from 'next/server'
import { withVersioning } from '@/middleware/api-versioning'

// Example v2 implementation with enhanced features
const v2Handler = async (request: NextRequest, version: string) => {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const page = parseInt(searchParams.get('page') || '1')
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')

  // Mock data in v2 format (enhanced structure)
  const posts = [
    {
      id: '1',
      text: 'Hello from v2 API!',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      status: 'published',
      platforms: ['twitter', 'facebook'],
      scheduledFor: null,
      metrics: {
        views: 1250,
        likes: 45,
        shares: 12,
        comments: 8
      },
      author: {
        id: 'user1',
        name: 'John Doe',
        avatar: 'https://example.com/avatar1.jpg'
      },
      workspace: {
        id: 'ws1',
        name: 'Marketing Team'
      }
    },
    {
      id: '2',
      text: 'Another post from v2 with enhanced features',
      createdAt: '2024-01-14T15:30:00Z',
      updatedAt: '2024-01-14T15:30:00Z',
      status: 'scheduled',
      platforms: ['linkedin'],
      scheduledFor: '2024-01-16T09:00:00Z',
      metrics: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0
      },
      author: {
        id: 'user1',
        name: 'John Doe',
        avatar: 'https://example.com/avatar1.jpg'
      },
      workspace: {
        id: 'ws1',
        name: 'Marketing Team'
      }
    }
  ]

  // Apply filters
  let filteredPosts = posts
  if (status) {
    filteredPosts = filteredPosts.filter(post => post.status === status)
  }
  if (platform) {
    filteredPosts = filteredPosts.filter(post => post.platforms.includes(platform))
  }

  const paginatedPosts = filteredPosts.slice((page - 1) * limit, page * limit)

  // v2 response format (standardized structure)
  return NextResponse.json({
    success: true,
    data: {
      posts: paginatedPosts,
      pagination: {
        page,
        limit,
        total: filteredPosts.length,
        totalPages: Math.ceil(filteredPosts.length / limit),
        hasNext: page * limit < filteredPosts.length,
        hasPrevious: page > 1
      },
      filters: {
        status,
        platform
      }
    },
    meta: {
      apiVersion: version,
      timestamp: new Date().toISOString(),
      responseTime: '45ms'
    }
  })
}

export const GET = withVersioning(v2Handler, 'posts')

// POST example for v2
const v2PostHandler = async (request: NextRequest, version: string) => {
  const body = await request.json()

  // Validate v2 payload structure
  const { text, platforms, scheduledFor, mediaIds, settings } = body

  if (!text || !platforms || !Array.isArray(platforms)) {
    return NextResponse.json({
      success: false,
      error: 'validation_error',
      message: 'Text and platforms are required',
      details: {
        text: !text ? ['Text is required'] : undefined,
        platforms: !platforms || !Array.isArray(platforms) ? ['Platforms must be an array'] : undefined
      }
    }, { status: 400 })
  }

  // Mock post creation
  const newPost = {
    id: Math.random().toString(36).substr(2, 9),
    text,
    platforms,
    scheduledFor: scheduledFor || null,
    status: scheduledFor ? 'scheduled' : 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mediaIds: mediaIds || [],
    settings: settings || {},
    metrics: {
      views: 0,
      likes: 0,
      shares: 0,
      comments: 0
    },
    author: {
      id: 'user1',
      name: 'John Doe',
      avatar: 'https://example.com/avatar1.jpg'
    },
    workspace: {
      id: 'ws1',
      name: 'Marketing Team'
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      post: newPost,
      message: scheduledFor ? 'Post scheduled successfully' : 'Post published successfully'
    },
    meta: {
      apiVersion: version,
      timestamp: new Date().toISOString(),
      responseTime: '120ms'
    }
  }, { status: 201 })
}

export const POST = withVersioning(v2PostHandler, 'posts')