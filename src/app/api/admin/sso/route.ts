import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/sso - Get all SSO configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    const type = searchParams.get('type')
    const includeAccounts = searchParams.get('includeAccounts') === 'true'

    // Build where clause
    const where: any = {}

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (type) {
      where.type = type.toUpperCase()
    }

    const ssoProviders = await prisma.sSOProvider.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        ssoAccounts: includeAccounts ? {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        } : undefined,
        _count: {
          select: {
            ssoAccounts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate statistics
    const stats = {
      total: ssoProviders.length,
      active: ssoProviders.filter(p => p.isActive).length,
      inactive: ssoProviders.filter(p => !p.isActive).length,
      types: {
        GOOGLE: ssoProviders.filter(p => p.type === 'GOOGLE').length,
        MICROSOFT: ssoProviders.filter(p => p.type === 'MICROSOFT').length,
        OKTA: ssoProviders.filter(p => p.type === 'OKTA').length,
        SAML: ssoProviders.filter(p => p.type === 'SAML').length,
        LDAP: ssoProviders.filter(p => p.type === 'LDAP').length
      },
      totalAccounts: ssoProviders.reduce((sum, p) => sum + p._count.ssoAccounts, 0)
    }

    return NextResponse.json({
      ssoProviders,
      stats
    })
  } catch (error) {
    console.error('Failed to fetch SSO providers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SSO providers' },
      { status: 500 }
    )
  }
}

// POST /api/admin/sso - Create new SSO provider configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      type,
      workspaceId,
      clientId,
      clientSecret,
      issuerUrl,
      callbackUrl,
      scopes = [],
      config = {},
      autoProvisioning = false,
      defaultRole = 'ANALYST',
      domainRestrictions = []
    } = body

    if (!name || !type || !workspaceId) {
      return NextResponse.json(
        { error: 'Name, type, and workspace ID are required' },
        { status: 400 }
      )
    }

    // Validate SSO type
    const validTypes = ['GOOGLE', 'MICROSOFT', 'OKTA', 'SAML', 'LDAP']
    if (!validTypes.includes(type.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid SSO type' },
        { status: 400 }
      )
    }

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Check if SSO provider already exists for this workspace and type
    const existingProvider = await prisma.sSOProvider.findFirst({
      where: {
        workspaceId,
        type: type.toUpperCase(),
        name
      }
    })

    if (existingProvider) {
      return NextResponse.json(
        { error: 'SSO provider with this name and type already exists for this workspace' },
        { status: 409 }
      )
    }

    // Validate required fields based on SSO type
    const requiredFields = getSSORequiredFields(type.toUpperCase())
    const missingFields = requiredFields.filter(field => !body[field])

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Create SSO provider configuration
    const ssoProvider = await prisma.sSOProvider.create({
      data: {
        name,
        type: type.toUpperCase(),
        workspaceId,
        clientId,
        clientSecret,
        issuerUrl,
        callbackUrl,
        scopes,
        config,
        autoProvisioning,
        defaultRole: defaultRole.toUpperCase(),
        domainRestrictions,
        isActive: true
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId,
        action: 'sso_provider_created',
        resource: 'sso_provider',
        resourceId: ssoProvider.id,
        newValues: {
          name: ssoProvider.name,
          type: ssoProvider.type,
          autoProvisioning,
          defaultRole
        },
        timestamp: new Date()
      }
    })

    // Return provider without sensitive data
    const { clientSecret: _, ...safeProvider } = ssoProvider

    return NextResponse.json(safeProvider, { status: 201 })
  } catch (error) {
    console.error('Failed to create SSO provider:', error)
    return NextResponse.json(
      { error: 'Failed to create SSO provider' },
      { status: 500 }
    )
  }
}

// Helper function to get required fields for each SSO type
function getSSORequiredFields(type: string): string[] {
  switch (type) {
    case 'GOOGLE':
      return ['clientId', 'clientSecret']
    case 'MICROSOFT':
      return ['clientId', 'clientSecret']
    case 'OKTA':
      return ['clientId', 'clientSecret', 'issuerUrl']
    case 'SAML':
      return ['issuerUrl', 'callbackUrl']
    case 'LDAP':
      return ['issuerUrl']
    default:
      return ['clientId', 'clientSecret']
  }
}