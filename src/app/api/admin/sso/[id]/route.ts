import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/sso/[id] - Get specific SSO provider
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const ssoProvider = await prisma.sSOProvider.findUnique({
      where: { id: params.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        ssoAccounts: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                createdAt: true
              }
            }
          },
          orderBy: {
            lastLoginAt: 'desc'
          }
        },
        _count: {
          select: {
            ssoAccounts: true
          }
        }
      }
    })

    if (!ssoProvider) {
      return NextResponse.json(
        { error: 'SSO provider not found' },
        { status: 404 }
      )
    }

    // Get usage statistics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentLogins = await prisma.sSOAccount.count({
      where: {
        providerId: params.id,
        lastLoginAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    const newAccounts = await prisma.sSOAccount.count({
      where: {
        providerId: params.id,
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    // Return provider without sensitive data
    const { clientSecret, ...safeProvider } = ssoProvider

    return NextResponse.json({
      ...safeProvider,
      stats: {
        totalAccounts: ssoProvider._count.ssoAccounts,
        recentLogins,
        newAccounts
      }
    })
  } catch (error) {
    console.error('Failed to fetch SSO provider:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SSO provider' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/sso/[id] - Update SSO provider
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      clientId,
      clientSecret,
      issuerUrl,
      callbackUrl,
      scopes,
      config,
      autoProvisioning,
      defaultRole,
      domainRestrictions,
      isActive
    } = body

    // Check if SSO provider exists
    const existingProvider = await prisma.sSOProvider.findUnique({
      where: { id: params.id }
    })

    if (!existingProvider) {
      return NextResponse.json(
        { error: 'SSO provider not found' },
        { status: 404 }
      )
    }

    // Update SSO provider
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (clientId !== undefined) updateData.clientId = clientId
    if (clientSecret !== undefined) updateData.clientSecret = clientSecret
    if (issuerUrl !== undefined) updateData.issuerUrl = issuerUrl
    if (callbackUrl !== undefined) updateData.callbackUrl = callbackUrl
    if (scopes !== undefined) updateData.scopes = scopes
    if (config !== undefined) updateData.config = config
    if (autoProvisioning !== undefined) updateData.autoProvisioning = autoProvisioning
    if (defaultRole !== undefined) updateData.defaultRole = defaultRole.toUpperCase()
    if (domainRestrictions !== undefined) updateData.domainRestrictions = domainRestrictions
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedProvider = await prisma.sSOProvider.update({
      where: { id: params.id },
      data: updateData
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId: existingProvider.workspaceId,
        action: 'sso_provider_updated',
        resource: 'sso_provider',
        resourceId: params.id,
        oldValues: {
          name: existingProvider.name,
          autoProvisioning: existingProvider.autoProvisioning,
          defaultRole: existingProvider.defaultRole,
          isActive: existingProvider.isActive
        },
        newValues: {
          name: updatedProvider.name,
          autoProvisioning: updatedProvider.autoProvisioning,
          defaultRole: updatedProvider.defaultRole,
          isActive: updatedProvider.isActive
        },
        changes: {
          name: name !== existingProvider.name,
          configuration: !!(clientId || clientSecret || issuerUrl || callbackUrl),
          autoProvisioning: autoProvisioning !== existingProvider.autoProvisioning,
          defaultRole: defaultRole !== existingProvider.defaultRole,
          isActive: isActive !== existingProvider.isActive
        },
        timestamp: new Date()
      }
    })

    // Return updated provider without sensitive data
    const { clientSecret: _, ...safeProvider } = updatedProvider

    return NextResponse.json(safeProvider)
  } catch (error) {
    console.error('Failed to update SSO provider:', error)
    return NextResponse.json(
      { error: 'Failed to update SSO provider' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/sso/[id] - Delete SSO provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if SSO provider exists
    const existingProvider = await prisma.sSOProvider.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            ssoAccounts: true
          }
        }
      }
    })

    if (!existingProvider) {
      return NextResponse.json(
        { error: 'SSO provider not found' },
        { status: 404 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const force = searchParams.get('force') === 'true'

    // Check if provider has linked accounts
    if (existingProvider._count.ssoAccounts > 0 && !force) {
      return NextResponse.json(
        {
          error: 'SSO provider has linked accounts. Use force=true to delete anyway.',
          linkedAccounts: existingProvider._count.ssoAccounts
        },
        { status: 400 }
      )
    }

    // Delete SSO provider and related accounts
    await prisma.$transaction(async (tx) => {
      // Delete all SSO accounts first
      await tx.sSOAccount.deleteMany({
        where: { providerId: params.id }
      })

      // Delete the provider
      await tx.sSOProvider.delete({
        where: { id: params.id }
      })
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId: existingProvider.workspaceId,
        action: 'sso_provider_deleted',
        resource: 'sso_provider',
        resourceId: params.id,
        oldValues: {
          name: existingProvider.name,
          type: existingProvider.type,
          linkedAccounts: existingProvider._count.ssoAccounts
        },
        metadata: {
          force,
          deletedBy: normalizedUserId
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete SSO provider:', error)
    return NextResponse.json(
      { error: 'Failed to delete SSO provider' },
      { status: 500 }
    )
  }
}