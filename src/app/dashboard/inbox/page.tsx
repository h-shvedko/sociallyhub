import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InboxDashboard } from '@/components/dashboard/inbox/inbox-dashboard'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export const metadata: Metadata = {
  title: 'Inbox | SociallyHub',
  description: 'Manage your social media messages, comments, and mentions in one unified inbox.',
}

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from user's primary workspace
  const userId = await normalizeUserId(session.user.id)
  
  const userWorkspace = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      role: 'OWNER'
    },
    select: {
      workspaceId: true
    }
  })

  if (!userWorkspace) {
    redirect('/dashboard/setup')
  }

  return <InboxDashboard workspaceId={userWorkspace.workspaceId} />
}