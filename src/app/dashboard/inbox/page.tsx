import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InboxDashboard } from '@/components/dashboard/inbox/inbox-dashboard'

export const metadata: Metadata = {
  title: 'Inbox | SociallyHub',
  description: 'Manage your social media messages, comments, and mentions in one unified inbox.',
}

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <InboxDashboard workspaceId={workspaceId} />
}