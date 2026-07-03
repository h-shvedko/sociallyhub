import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// GET /api/admin/sso/[id] - Get specific SSO provider
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireAdmin()

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
    return handleApiError(error)
  }
}

// PUT /api/admin/sso/[id] - Update SSO provider
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAdmin()

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
        userId: user.id,
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
    return handleApiError(error)
  }
}

// DELETE /api/admin/sso/[id] - Delete SSO provider
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireAdmin()

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
        userId: user.id,
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
          deletedBy: user.id
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}