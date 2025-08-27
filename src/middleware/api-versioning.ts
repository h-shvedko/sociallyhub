import { NextRequest, NextResponse } from 'next/server'
import {
  getVersionFromRequest,
  validateVersion,
  getVersionHeaders,
  transformResponseForVersion,
  VersionMismatchError,
  API_VERSIONS,
  CURRENT_VERSION
} from '@/lib/api-docs/versioning'

export interface VersionedApiHandler {
  (request: NextRequest, version: string): Promise<NextResponse> | NextResponse
}

export function withVersioning(handler: VersionedApiHandler, endpointName?: string) {
  return async function versionedHandler(request: NextRequest): Promise<NextResponse> {
    try {
      // Extract version from request
      const version = getVersionFromRequest(request)
      
      // Validate version
      if (!validateVersion(version)) {
        throw new VersionMismatchError(version, API_VERSIONS)
      }
      
      // Call the handler with version context
      const response = await handler(request, version)
      
      // Add versioning headers
      const versionHeaders = getVersionHeaders(version)
      Object.entries(versionHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      // Transform response if needed for backward compatibility
      if (endpointName) {
        try {
          const originalBody = await response.text()
          let data = originalBody ? JSON.parse(originalBody) : {}
          
          // Apply version-specific transformations
          data = transformResponseForVersion(data, version, endpointName)
          
          return new NextResponse(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          })
        } catch (e) {
          // If response transformation fails, return original response
          return response
        }
      }
      
      return response
      
    } catch (error) {
      if (error instanceof VersionMismatchError) {
        return NextResponse.json(
          {
            error: 'version_mismatch',
            message: error.message,
            supportedVersions: API_VERSIONS,
            currentVersion: CURRENT_VERSION,
            timestamp: new Date().toISOString()
          },
          { 
            status: 400,
            headers: {
              'X-API-Current-Version': CURRENT_VERSION,
              'X-API-Supported-Versions': API_VERSIONS.join(', ')
            }
          }
        )
      }
      
      // Re-throw other errors
      throw error
    }
  }
}

export function createVersionedEndpoint(handlers: Partial<Record<string, VersionedApiHandler>>, endpointName?: string) {
  return withVersioning(async (request: NextRequest, version: string) => {
    const handler = handlers[version]
    
    if (!handler) {
      // If no specific handler for version, try to use current version handler
      const currentHandler = handlers[CURRENT_VERSION] || handlers['v2']
      if (currentHandler) {
        return currentHandler(request, version)
      }
      
      throw new VersionMismatchError(version, Object.keys(handlers))
    }
    
    return handler(request, version)
  }, endpointName)
}

// Utility function to get version info for documentation
export function getVersionInfo() {
  return {
    currentVersion: CURRENT_VERSION,
    supportedVersions: API_VERSIONS,
    versioningMethods: [
      {
        method: 'path',
        description: 'Include version in URL path',
        example: '/api/v2/posts'
      },
      {
        method: 'header',
        description: 'Use X-API-Version header',
        example: 'X-API-Version: v2'
      },
      {
        method: 'accept',
        description: 'Use Accept header with vendor-specific media type',
        example: 'Accept: application/vnd.sociallyhub.v2+json'
      }
    ]
  }
}

// Middleware for global API versioning (can be used in middleware.ts)
export function apiVersioningMiddleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Skip versioning for certain routes
  const skipVersioning = [
    '/api/auth/signin',
    '/api/auth/signup', 
    '/api/health',
    '/api/version'
  ]
  
  if (skipVersioning.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  try {
    const version = getVersionFromRequest(request)
    
    if (!validateVersion(version)) {
      return NextResponse.json(
        {
          error: 'version_mismatch',
          message: `Unsupported API version: ${version}`,
          supportedVersions: API_VERSIONS,
          currentVersion: CURRENT_VERSION
        },
        { 
          status: 400,
          headers: {
            'X-API-Current-Version': CURRENT_VERSION,
            'X-API-Supported-Versions': API_VERSIONS.join(', ')
          }
        }
      )
    }
    
    // Add version headers to all API responses
    const response = NextResponse.next()
    const versionHeaders = getVersionHeaders(version)
    
    Object.entries(versionHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Failed to process API version',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}