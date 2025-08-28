import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AssetsManager } from '@/components/dashboard/assets/assets-manager'

export const metadata: Metadata = {
  title: 'Assets | SociallyHub',
  description: 'Manage your media assets, images, videos, and files for social media content.',
}

export default async function AssetsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <AssetsManager workspaceId={workspaceId} />
}