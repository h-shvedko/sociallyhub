import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// GET /api/admin/workspaces - Read-only list of workspaces with member counts.
//
// ADR-0012: reduced to real `Workspace` fields only. The model has no
// `status`/`plan`/`domain`/`settings`/`locale` columns and no `teams`
// relation (Team was cut), so those filters/selects/writes were removed.
// Plan/subscription state is owned by Stripe (ADR-0019); workspace
// suspension, if ever needed, is proposed separately under ADR-0016.
// The workspace-creation path was cut with the admin teams/workspaces
// creation routes (ADR-0012 v1 page scope).
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const includeMembers = searchParams.get('includeMembers') === 'true'
    const search = searchParams.get('search')

    // Build where clause using real fields only.
    const where: any = {}

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const workspaces = await prisma.workspace.findMany({
      where,
      select: {
        id: true,
        name: true,
        timezone: true,
        defaultLocale: true,
        supportedLocales: true,
        createdAt: true,
        updatedAt: true,
        users: includeMembers
          ? {
              select: {
                role: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true
                  }
                }
              }
            }
          : false,
        _count: {
          select: {
            users: true,
            posts: true,
            socialAccounts: true,
            campaigns: true,
            clients: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Statistics from real data only.
    const stats = {
      total: workspaces.length,
      totalMembers: workspaces.reduce((sum, w) => sum + w._count.users, 0)
    }

    return NextResponse.json({
      workspaces,
      stats
    })
  } catch (error) {
    return handleApiError(error)
  }
}
