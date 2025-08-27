import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import { redirect } from 'next/navigation'
import { CampaignDashboard } from '@/components/dashboard/campaigns/campaign-dashboard'

export const metadata: Metadata = {
  title: 'Campaign Management | SociallyHub',
  description: 'Create, manage, and track your marketing campaigns with advanced analytics and A/B testing.',
}

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <CampaignDashboard workspaceId={workspaceId} />
}