import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TeamManager } from '@/components/dashboard/team/team-manager'

export const metadata: Metadata = {
  title: 'Team | SociallyHub',
  description: 'Manage your team members, roles, and permissions for collaborative content management.',
}

export default async function TeamPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <TeamManager workspaceId={workspaceId} />
}