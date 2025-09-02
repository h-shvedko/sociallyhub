import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SocialAccountsManager } from '@/components/dashboard/accounts/social-accounts-manager'

export const metadata: Metadata = {
  title: 'Social Accounts | SociallyHub',
  description: 'Connect and manage your social media accounts for posting and monitoring.',
}

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <SocialAccountsManager workspaceId={workspaceId} />
}