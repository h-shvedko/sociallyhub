import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { TeamManager } from '@/components/dashboard/team/team-manager'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export const metadata: Metadata = {
  title: 'Team | SociallyHub',
  description: 'Manage your team members, roles, and permissions for collaborative content management.',
}

export default async function TeamPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const userId = await normalizeUserId(session.user.id)
  
  // Get user's workspace
  const userWorkspace = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      role: { in: ['OWNER', 'ADMIN'] }
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  if (!userWorkspace) {
    redirect('/dashboard')
  }

  return (
    <TeamManager 
      workspaceId={userWorkspace.workspaceId} 
      workspaceName={userWorkspace.workspace.name} 
    />
  )
}