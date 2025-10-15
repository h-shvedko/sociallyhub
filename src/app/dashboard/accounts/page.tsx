import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { AccountsPageClient } from '@/components/dashboard/accounts/accounts-page-client'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export const metadata: Metadata = {
  title: 'Social Accounts | SociallyHub',
  description: 'Connect and manage your social media accounts for posting and monitoring.',
}

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  // Get user's workspace and check permissions
  const userId = await normalizeUserId(session.user.id)

  const userWorkspace = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
    },
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  if (!userWorkspace) {
    redirect('/auth/signin?error=no-workspace-access')
  }

  // Check if user can manage credentials (OWNER or ADMIN only)
  const canManageCredentials = ['OWNER', 'ADMIN'].includes(userWorkspace.role)

  return (
    <AccountsPageClient
      workspaceId={userWorkspace.workspaceId}
      workspaceName={userWorkspace.workspace.name}
      userRole={userWorkspace.role}
      canManageCredentials={canManageCredentials}
    />
  )
}