export const API_VERSIONS = ['v1', 'v2'] as const
export type ApiVersion = typeof API_VERSIONS[number]

export const CURRENT_VERSION: ApiVersion = 'v2'
export const DEPRECATED_VERSIONS: ApiVersion[] = ['v1']

export interface VersionConfig {
  version: ApiVersion
  isDeprecated: boolean
  deprecationDate?: string
  sunsetDate?: string
  description: string
  changes: string[]
  breakingChanges?: string[]
}

export const VERSION_CONFIGS: Record<ApiVersion, VersionConfig> = {
  v1: {
    version: 'v1',
    isDeprecated: true,
    deprecationDate: '2024-01-15',
    sunsetDate: '2024-12-31',
    description: 'Initial API version with basic functionality',
    changes: [
      'Basic authentication with JWT tokens',
      'Simple post creation and management',
      'Basic analytics endpoints',
      'Workspace management'
    ],
    breakingChanges: [
      'Authentication response format changed in v2',
      'Post creation payload structure updated',
      'Error response format standardized'
    ]
  },
  v2: {
    version: 'v2',
    isDeprecated: false,
    description: 'Enhanced API version with improved functionality and security',
    changes: [
      'Enhanced authentication with refresh tokens',
      'Bulk operations for posts and campaigns',
      'Advanced analytics with custom metrics',
      'Webhook support for real-time notifications',
      'Improved error handling and validation',
      'Rate limiting with detailed headers',
      'Enhanced security with HMAC signatures'
    ]
  }
}

export function getVersionFromRequest(request: Request): ApiVersion {
  const url = new URL(request.url)
  
  // Check version in path (e.g., /api/v2/posts)
  const pathVersion = url.pathname.match(/\/api\/(v\d+)\//)?.[1] as ApiVersion
  if (pathVersion && API_VERSIONS.includes(pathVersion)) {
    return pathVersion
  }
  
  // Check Accept header (e.g., application/vnd.sociallyhub.v2+json)
  const acceptHeader = request.headers.get('accept') || ''
  const acceptVersion = acceptHeader.match(/vnd\.sociallyhub\.(v\d+)/)?.[1] as ApiVersion
  if (acceptVersion && API_VERSIONS.includes(acceptVersion)) {
    return acceptVersion
  }
  
  // Check custom version header
  const versionHeader = request.headers.get('x-api-version') as ApiVersion
  if (versionHeader && API_VERSIONS.includes(versionHeader)) {
    return versionHeader
  }
  
  // Default to current version
  return CURRENT_VERSION
}

export function validateVersion(version: string): version is ApiVersion {
  return API_VERSIONS.includes(version as ApiVersion)
}

export function getVersionHeaders(version: ApiVersion): Record<string, string> {
  const config = VERSION_CONFIGS[version]
  const headers: Record<string, string> = {
    'X-API-Version': version,
    'X-API-Current-Version': CURRENT_VERSION
  }
  
  if (config.isDeprecated) {
    headers['X-API-Deprecated'] = 'true'
    if (config.deprecationDate) {
      headers['X-API-Deprecated-Date'] = config.deprecationDate
    }
    if (config.sunsetDate) {
      headers['X-API-Sunset-Date'] = config.sunsetDate
    }
    headers['Warning'] = `299 - "API version ${version} is deprecated. Please migrate to version ${CURRENT_VERSION}."`
  }
  
  return headers
}

export function transformResponseForVersion(data: any, version: ApiVersion, endpoint: string): any {
  // Transform responses based on version requirements
  switch (version) {
    case 'v1':
      return transformToV1(data, endpoint)
    case 'v2':
      return data // Current format
    default:
      return data
  }
}

function transformToV1(data: any, endpoint: string): any {
  // Handle backward compatibility transformations
  switch (endpoint) {
    case 'auth':
      // v1 auth response format
      if (data.data?.user && data.data?.accessToken) {
        return {
          user: data.data.user,
          token: data.data.accessToken,
          expires: data.data.expiresIn
        }
      }
      break
      
    case 'posts':
      // v1 posts format
      if (Array.isArray(data.data?.posts)) {
        return {
          posts: data.data.posts.map((post: any) => ({
            id: post.id,
            content: post.text,
            created_at: post.createdAt,
            status: post.status,
            platforms: post.platforms
          })),
          total: data.data.total
        }
      }
      break
      
    case 'analytics':
      // v1 analytics format
      if (data.data?.metrics) {
        return {
          metrics: data.data.metrics,
          period: data.data.dateRange
        }
      }
      break
  }
  
  return data
}

export class VersionMismatchError extends Error {
  constructor(requestedVersion: string, supportedVersions: string[]) {
    super(`Unsupported API version: ${requestedVersion}. Supported versions: ${supportedVersions.join(', ')}`)
    this.name = 'VersionMismatchError'
  }
}