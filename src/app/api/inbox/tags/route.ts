import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

export async function GET(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Get all unique tags from inbox items
    const inboxItems = await prisma.inboxItem.findMany({
      where: { workspaceId },
      select: { tags: true }
    })

    // Flatten and deduplicate tags
    const allTags = inboxItems.flatMap(item => item.tags)
    const uniqueTags = [...new Set(allTags)].sort()

    return NextResponse.json({
      tags: uniqueTags
    })
  }, 'inbox-tags')(request)
}