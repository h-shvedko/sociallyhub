import { NextRequest, NextResponse } from 'next/server'
import { withVersioning } from '@/middleware/api-versioning'

// Example v1 implementation for backward compatibility
const v1Handler = async (request: NextRequest, version: string) => {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const page = parseInt(searchParams.get('page') || '1')

  // Mock data in v1 format
  const posts = [
    {
      id: '1',
      content: 'Hello from v1 API!',
      created_at: '2024-01-15T10:00:00Z',
      status: 'published',
      platforms: ['twitter', 'facebook']
    },
    {
      id: '2', 
      content: 'Another post from v1',
      created_at: '2024-01-14T15:30:00Z',
      status: 'scheduled',
      platforms: ['linkedin']
    }
  ]

  // v1 response format (different from v2)
  return NextResponse.json({
    posts: posts.slice((page - 1) * limit, page * limit),
    total: posts.length,
    page,
    per_page: limit
  })
}

export const GET = withVersioning(v1Handler, 'posts')