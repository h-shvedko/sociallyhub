// GDPR Art.15/20 data export (ADR-0017 Track C, Phase 2 item 8).
//
// Assembles a downloadable JSON bundle STRICTLY scoped to the authenticated
// user. Never includes the password hash, 2FA secrets, or any other user's
// data. Every query is filtered by this user's id; workspace memberships list
// only the caller's own row (role/joinedAt + workspace name), NOT other
// members. User-authored content is included as bounded references (ids), not
// full cross-tenant row dumps.

import { NextResponse } from 'next/server'

import { requireSession } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Cap on authored-post ids to keep the export bounded.
const MAX_AUTHORED_POST_IDS = 5000

async function buildExport() {
  const auth = await requireSession()

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    // Explicit allow-list — NEVER select password / twoFactor secrets.
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      timezone: true,
      locale: true,
    },
  })
  if (!user) {
    return { error: jsonError(404, 'User not found') as NextResponse }
  }

  const [settings, notificationPreferences, memberships, authoredPostCount, authoredPostIds] =
    await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: auth.id } }),
      prisma.notificationPreferences.findUnique({ where: { userId: auth.id } }),
      prisma.userWorkspace.findMany({
        where: { userId: auth.id },
        select: {
          workspaceId: true,
          role: true,
          createdAt: true, // exposed as joinedAt below
          workspace: { select: { name: true } },
        },
      }),
      prisma.post.count({ where: { ownerId: auth.id } }),
      prisma.post.findMany({
        where: { ownerId: auth.id },
        select: { id: true },
        take: MAX_AUTHORED_POST_IDS,
        orderBy: { createdAt: 'desc' },
      }),
    ])

  const bundle = {
    exportedAt: new Date().toISOString(),
    format: 'sociallyhub-user-export-v1',
    user,
    settings: settings ?? null,
    notificationPreferences: notificationPreferences ?? null,
    workspaceMemberships: memberships.map((m) => ({
      workspaceId: m.workspaceId,
      workspaceName: m.workspace?.name ?? null,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    authoredContent: {
      posts: {
        total: authoredPostCount,
        includedIds: authoredPostIds.map((p) => p.id),
        truncated: authoredPostCount > authoredPostIds.length,
      },
    },
  }

  return { bundle, userId: user.id }
}

function toResponse(result: Awaited<ReturnType<typeof buildExport>>) {
  if ('error' in result) return result.error

  const body = JSON.stringify(result.bundle, null, 2)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="sociallyhub-export-${result.userId}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET() {
  try {
    return toResponse(await buildExport())
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST() {
  try {
    return toResponse(await buildExport())
  } catch (error) {
    return handleApiError(error)
  }
}
