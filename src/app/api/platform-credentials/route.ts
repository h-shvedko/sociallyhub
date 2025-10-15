import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { encryptCredentials, decryptCredentials } from '@/lib/encryption'

// GET /api/platform-credentials - Get all platform credentials for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] } // Only admins can manage credentials
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get all platform credentials for workspace
    const credentials = await prisma.platformCredentials.findMany({
      where: { workspaceId },
      select: {
        id: true,
        platform: true,
        isActive: true,
        environment: true,
        validationStatus: true,
        validationError: true,
        lastValidated: true,
        lastUsed: true,
        usageCount: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // Don't return actual credentials for security
      },
      orderBy: { platform: 'asc' }
    })

    return NextResponse.json({
      credentials,
      total: credentials.length
    })
  } catch (error) {
    console.error('Error fetching platform credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch platform credentials' },
      { status: 500 }
    )
  }
}

// POST /api/platform-credentials - Create or update platform credentials
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()
    const { workspaceId, platform, credentials, environment, notes } = body

    if (!workspaceId || !platform || !credentials) {
      return NextResponse.json({
        error: 'Workspace ID, platform, and credentials are required'
      }, { status: 400 })
    }

    // Verify user has access to workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate platform credentials structure
    const validationResult = await validatePlatformCredentials(platform, credentials)

    // Encrypt credentials before storing
    const encryptedCredentials = encryptCredentials(credentials)

    // Upsert platform credentials
    const platformCredentials = await prisma.platformCredentials.upsert({
      where: {
        workspaceId_platform: {
          workspaceId,
          platform: platform.toUpperCase()
        }
      },
      update: {
        credentials: encryptedCredentials,
        environment: environment || 'production',
        notes: notes || null,
        validationStatus: validationResult.isValid ? 'valid' : 'invalid',
        validationError: validationResult.error || null,
        lastValidated: new Date(),
        configuredBy: userId
      },
      create: {
        workspaceId,
        platform: platform.toUpperCase(),
        credentials: encryptedCredentials,
        environment: environment || 'production',
        notes: notes || null,
        validationStatus: validationResult.isValid ? 'valid' : 'invalid',
        validationError: validationResult.error || null,
        lastValidated: new Date(),
        configuredBy: userId
      },
      select: {
        id: true,
        platform: true,
        isActive: true,
        environment: true,
        validationStatus: true,
        validationError: true,
        lastValidated: true,
        notes: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      credentials: platformCredentials,
      message: `${platform} credentials ${validationResult.isValid ? 'configured successfully' : 'saved with validation errors'}`
    })
  } catch (error) {
    console.error('Error saving platform credentials:', error)
    return NextResponse.json(
      { error: 'Failed to save platform credentials' },
      { status: 500 }
    )
  }
}

// Validate platform-specific credentials
async function validatePlatformCredentials(platform: string, credentials: any) {
  try {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return validateTwitterCredentials(credentials)
      case 'facebook':
        return validateFacebookCredentials(credentials)
      case 'instagram':
        return validateInstagramCredentials(credentials)
      case 'linkedin':
        return validateLinkedInCredentials(credentials)
      case 'tiktok':
        return validateTikTokCredentials(credentials)
      case 'youtube':
        return validateYouTubeCredentials(credentials)
      default:
        return { isValid: false, error: 'Unsupported platform' }
    }
  } catch (error) {
    return { isValid: false, error: 'Validation failed: ' + (error as Error).message }
  }
}

function validateTwitterCredentials(credentials: any) {
  const required = ['clientId', 'clientSecret']
  const optional = ['apiKey', 'apiSecret', 'bearerToken', 'accessToken', 'accessTokenSecret']

  for (const field of required) {
    if (!credentials[field]) {
      return { isValid: false, error: `Missing required field: ${field}` }
    }
  }

  return { isValid: true }
}

function validateFacebookCredentials(credentials: any) {
  const required = ['appId', 'appSecret']

  for (const field of required) {
    if (!credentials[field]) {
      return { isValid: false, error: `Missing required field: ${field}` }
    }
  }

  return { isValid: true }
}

function validateInstagramCredentials(credentials: any) {
  const required = ['clientId', 'clientSecret']

  for (const field of required) {
    if (!credentials[field]) {
      return { isValid: false, error: `Missing required field: ${field}` }
    }
  }

  return { isValid: true }
}

function validateLinkedInCredentials(credentials: any) {
  const required = ['clientId', 'clientSecret']

  for (const field of required) {
    if (!credentials[field]) {
      return { isValid: false, error: `Missing required field: ${field}` }
    }
  }

  return { isValid: true }
}

function validateTikTokCredentials(credentials: any) {
  const required = ['clientId', 'clientSecret']

  for (const field of required) {
    if (!credentials[field]) {
      return { isValid: false, error: `Missing required field: ${field}` }
    }
  }

  return { isValid: true }
}

function validateYouTubeCredentials(credentials: any) {
  const required = ['clientId', 'clientSecret']
  const optional = ['apiKey']

  for (const field of required) {
    if (!credentials[field]) {
      return { isValid: false, error: `Missing required field: ${field}` }
    }
  }

  return { isValid: true }
}