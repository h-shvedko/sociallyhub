import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/auth-options'
import { ClientDashboard } from '@/components/dashboard/clients/client-dashboard'

export const metadata: Metadata = {
  title: 'Client Management - SociallyHub',
  description: 'Manage your clients, track relationships, and monitor progress',
}

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or default
  const workspaceId = session.user?.workspaceId || 'default-workspace'

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <ClientDashboard workspaceId={workspaceId} />
    </div>
  )
}