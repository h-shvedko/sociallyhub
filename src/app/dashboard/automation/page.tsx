import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AutomationDashboard } from '@/components/dashboard/automation/automation-dashboard'
import { prisma } from '@/lib/prisma'
export default async function AutomationPage() {
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AutomationDashboard workspaceId={userWorkspace.workspaceId} />
    </div>
  )
}