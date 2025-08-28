import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { AutomationDashboard } from '@/components/dashboard/automation/automation-dashboard'

export default async function AutomationPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // For demo purposes, we'll use a mock workspace ID
  // In a real app, this would come from the user's context or URL params
  const workspaceId = 'demo-workspace-id'

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AutomationDashboard workspaceId={workspaceId} />
    </div>
  )
}