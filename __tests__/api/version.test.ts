/**
 * @jest-environment node
 */
import { GET } from '@/app/api/version/route'
import { NextRequest } from 'next/server'
import { CURRENT_VERSION } from '@/lib/api-docs/versioning'

describe('/api/version', () => {
  it('returns current API version information', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('currentVersion', CURRENT_VERSION)
    expect(result.data).toHaveProperty('supportedVersions')
    expect(result.data).toHaveProperty('versionDetails')
    expect(result.data).toHaveProperty('documentation')
    expect(result.data).toHaveProperty('endpoints')
    expect(result.data).toHaveProperty('rateLimit')
    expect(result.data).toHaveProperty('headers')
  })

  it('includes correct version headers', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)

    expect(response.headers.get('X-API-Version')).toBe(CURRENT_VERSION)
    expect(response.headers.get('X-API-Current-Version')).toBe(CURRENT_VERSION)
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=3600')
  })

  it('provides documentation URLs', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    expect(result.data.documentation).toHaveProperty('url')
    expect(result.data.documentation.url).toContain('/api/docs')
    expect(result.data.documentation).toHaveProperty('description')
  })

  it('lists available endpoints', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    const endpoints = result.data.endpoints
    expect(endpoints).toHaveProperty('health')
    expect(endpoints).toHaveProperty('version')
    expect(endpoints).toHaveProperty('auth')
    expect(endpoints).toHaveProperty('posts')
    expect(endpoints).toHaveProperty('analytics')
    expect(endpoints).toHaveProperty('workspaces')
    expect(endpoints).toHaveProperty('webhooks')
  })

  it('includes rate limit information', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    const rateLimit = result.data.rateLimit
    expect(rateLimit).toHaveProperty('default')
    expect(rateLimit).toHaveProperty('authenticated')
    expect(rateLimit).toHaveProperty('premium')
    
    expect(rateLimit.default).toContain('requests per hour')
    expect(rateLimit.authenticated).toContain('requests per hour')
    expect(rateLimit.premium).toContain('requests per hour')
  })

  it('provides header information', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    const headers = result.data.headers
    expect(headers).toHaveProperty('version', 'X-API-Version')
    expect(headers).toHaveProperty('currentVersion', 'X-API-Current-Version')
    expect(headers).toHaveProperty('deprecated', 'X-API-Deprecated')
    expect(headers).toHaveProperty('sunset', 'X-API-Sunset-Date')
  })

  it('includes timestamp in response', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    expect(result).toHaveProperty('timestamp')
    expect(new Date(result.timestamp)).toBeInstanceOf(Date)
  })

  it('includes version details with configurations', async () => {
    const request = new NextRequest('http://localhost:3099/api/version')

    const response = await GET(request)
    const result = await response.json()

    const versionDetails = result.data.versionDetails
    expect(versionDetails).toBeDefined()
    expect(typeof versionDetails).toBe('object')
    
    // Should include version configurations
    Object.values(versionDetails).forEach((config: any) => {
      expect(config).toHaveProperty('version')
      expect(config).toHaveProperty('description')
      expect(config).toHaveProperty('changes')
      expect(Array.isArray(config.changes)).toBe(true)
    })
  })
})