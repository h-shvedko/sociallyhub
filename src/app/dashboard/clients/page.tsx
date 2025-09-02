import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ClientDashboard } from '@/components/dashboard/clients/client-dashboard'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export const metadata: Metadata = {
  title: 'Client Management - SociallyHub',
  description: 'Manage your clients, track relationships, and monitor progress',
}

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from user's primary workspace
  const userId = await normalizeUserId(session.user.id)
  
  const userWorkspace = await prisma.userWorkspace.findFirst({
    where: {
      userId,
      role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
    },
    select: {
      workspaceId: true
    }
  })

  if (!userWorkspace) {
    redirect('/auth/signin?error=no-workspace')
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <ClientDashboard workspaceId={userWorkspace.workspaceId} />
    </div>
  )
}