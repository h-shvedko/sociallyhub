import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TemplateManager } from '@/components/dashboard/templates/template-manager'

export const metadata: Metadata = {
  title: 'Templates | SociallyHub',
  description: 'Create and manage reusable content templates for social media posts.',
}

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <TemplateManager workspaceId={workspaceId} />
}