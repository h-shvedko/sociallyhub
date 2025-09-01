import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TemplateManager } from '@/components/dashboard/templates/template-manager'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export const metadata: Metadata = {
  title: 'Templates | SociallyHub',
  description: 'Create and manage reusable content templates for social media posts.',
}

export default async function TemplatesPage() {
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

  return <TemplateManager workspaceId={userWorkspace.workspaceId} />
}