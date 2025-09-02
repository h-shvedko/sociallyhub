import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AssetsManager } from '@/components/dashboard/assets/assets-manager'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export const metadata: Metadata = {
  title: 'Assets | SociallyHub',
  description: 'Manage your media assets, images, videos, and files for social media content.',
}

export default async function AssetsPage() {
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

  return <AssetsManager workspaceId={userWorkspace.workspaceId} />
}