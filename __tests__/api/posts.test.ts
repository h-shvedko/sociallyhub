/**
 * @jest-environment node
 */
import { createRequest, createResponse } from 'node-mocks-http'
import { GET as getPostsHandler, POST as createPostHandler } from '@/app/api/posts/route'
import { NextRequest } from 'next/server'

// Mock auth verification
jest.mock('@/lib/auth/verify-token', () => ({
  verifyToken: jest.fn().mockResolvedValue({
    userId: 'user-123',
    workspaceId: 'workspace-123',
  }),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  post: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}))

// Mock job queue
jest.mock('@/lib/jobs/queue-manager', () => ({
  addJob: jest.fn(),
}))

const mockPrisma = require('@/lib/prisma')
const mockQueueManager = require('@/lib/jobs/queue-manager')

describe('/api/posts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/posts', () => {
    it('fetches posts successfully', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          text: 'First post',
          status: 'published',
          platforms: ['twitter', 'facebook'],
          createdAt: new Date('2024-01-01'),
          author: {
            id: 'user-123',
            name: 'Test User',
          },
        },
        {
          id: 'post-2',
          text: 'Second post',
          status: 'scheduled',
          platforms: ['linkedin'],
          scheduledFor: new Date('2024-01-02'),
          createdAt: new Date('2024-01-01'),
          author: {
            id: 'user-123',
            name: 'Test User',
          },
        },
      ]

      mockPrisma.post.findMany.mockResolvedValue(mockPosts)
      mockPrisma.post.count.mockResolvedValue(2)

      const request = new NextRequest('http://localhost:3099/api/posts', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      const response = await getPostsHandler(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.posts).toHaveLength(2)
      expect(result.data.posts[0]).toMatchObject({
        id: 'post-1',
        text: 'First post',
        status: 'published',
      })
    })

    it('handles pagination correctly', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.post.count.mockResolvedValue(25)

      const request = new NextRequest(
        'http://localhost:3099/api/posts?page=2&limit=10',
        {
          headers: {
            Authorization: 'Bearer valid-token',
          },
        }
      )

      const response = await getPostsHandler(request)
      const result = await response.json()

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        skip: 10, // (page-1) * limit
        take: 10,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })

      expect(result.data.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      })
    })

    it('filters posts by status', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.post.count.mockResolvedValue(0)

      const request = new NextRequest(
        'http://localhost:3099/api/posts?status=published',
        {
          headers: {
            Authorization: 'Bearer valid-token',
          },
        }
      )

      await getPostsHandler(request)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-123',
          status: 'published',
        },
        skip: 0,
        take: 10,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('requires authentication', async () => {
      const mockVerifyToken = require('@/lib/auth/verify-token').verifyToken
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'))

      const request = new NextRequest('http://localhost:3099/api/posts')

      const response = await getPostsHandler(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toBe('unauthorized')
    })
  })

  describe('POST /api/posts', () => {
    it('creates a post successfully', async () => {
      const postData = {
        text: 'New post content',
        platforms: ['twitter', 'facebook'],
      }

      const mockCreatedPost = {
        id: 'post-123',
        text: postData.text,
        platforms: postData.platforms,
        status: 'published',
        createdAt: new Date(),
        authorId: 'user-123',
        workspaceId: 'workspace-123',
      }

      mockPrisma.post.create.mockResolvedValue(mockCreatedPost)

      const request = new NextRequest('http://localhost:3099/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(postData),
      })

      const response = await createPostHandler(request)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(result.success).toBe(true)
      expect(result.data.post).toMatchObject({
        id: 'post-123',
        text: postData.text,
        platforms: postData.platforms,
      })

      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: {
          text: postData.text,
          platforms: postData.platforms,
          status: 'published',
          authorId: 'user-123',
          workspaceId: 'workspace-123',
          scheduledFor: null,
        },
        include: expect.any(Object),
      })
    })

    it('schedules a post for later', async () => {
      const scheduledDate = new Date('2024-12-25T10:00:00Z')
      const postData = {
        text: 'Scheduled post',
        platforms: ['twitter'],
        scheduledFor: scheduledDate.toISOString(),
      }

      const mockScheduledPost = {
        id: 'post-456',
        text: postData.text,
        platforms: postData.platforms,
        status: 'scheduled',
        scheduledFor: scheduledDate,
        createdAt: new Date(),
        authorId: 'user-123',
        workspaceId: 'workspace-123',
      }

      mockPrisma.post.create.mockResolvedValue(mockScheduledPost)
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-123' })

      const request = new NextRequest('http://localhost:3099/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(postData),
      })

      const response = await createPostHandler(request)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(result.success).toBe(true)
      expect(result.data.post.status).toBe('scheduled')

      // Verify job was scheduled
      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'post-scheduler',
        'schedule-post',
        {
          postId: 'post-456',
          platforms: postData.platforms,
        },
        {
          delay: expect.any(Number),
          jobId: `post-${mockScheduledPost.id}`,
        }
      )
    })

    it('validates post data', async () => {
      const invalidData = {
        text: '', // empty text
        platforms: [], // no platforms
      }

      const request = new NextRequest('http://localhost:3099/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(invalidData),
      })

      const response = await createPostHandler(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe('validation_error')
      expect(result.details).toBeDefined()
    })

    it('handles platform-specific validation', async () => {
      const longPostData = {
        text: 'a'.repeat(300), // Too long for Twitter
        platforms: ['twitter'],
      }

      const request = new NextRequest('http://localhost:3099/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(longPostData),
      })

      const response = await createPostHandler(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Twitter')
      expect(result.message).toContain('280')
    })

    it('handles database errors', async () => {
      const postData = {
        text: 'Test post',
        platforms: ['twitter'],
      }

      mockPrisma.post.create.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3099/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(postData),
      })

      const response = await createPostHandler(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
      expect(result.error).toBe('post_creation_failed')
    })

    it('requires valid platforms', async () => {
      const postData = {
        text: 'Test post',
        platforms: ['invalid-platform'],
      }

      const request = new NextRequest('http://localhost:3099/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(postData),
      })

      const response = await createPostHandler(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe('validation_error')
    })
  })
})