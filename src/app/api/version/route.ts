import { NextRequest, NextResponse } from 'next/server'
import { getVersionInfo } from '@/middleware/api-versioning'
import { VERSION_CONFIGS, CURRENT_VERSION } from '@/lib/api-docs/versioning'

export async function GET(request: NextRequest) {
  const versionInfo = getVersionInfo()
  
  return NextResponse.json({
    success: true,
    data: {
      ...versionInfo,
      versionDetails: VERSION_CONFIGS,
      documentation: {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3099'}/api/docs`,
        description: 'Complete API documentation with interactive explorer'
      },
      endpoints: {
        health: '/api/health',
        version: '/api/version',
        auth: '/api/auth/*',
        posts: '/api/posts/*',
        analytics: '/api/analytics/*',
        workspaces: '/api/workspaces/*',
        webhooks: '/api/webhooks/*'
      },
      rateLimit: {
        default: '1000 requests per hour',
        authenticated: '5000 requests per hour',
        premium: '10000 requests per hour'
      },
      headers: {
        version: 'X-API-Version',
        currentVersion: 'X-API-Current-Version',
        deprecated: 'X-API-Deprecated',
        sunset: 'X-API-Sunset-Date'
      }
    },
    timestamp: new Date().toISOString()
  }, {
    headers: {
      'X-API-Version': CURRENT_VERSION,
      'X-API-Current-Version': CURRENT_VERSION,
      'Cache-Control': 'public, s-maxage=3600'
    }
  })
}