import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PostComposer } from '@/components/dashboard/posts/post-composer'

export const metadata: Metadata = {
  title: 'Compose Post | SociallyHub',
  description: 'Create and schedule new social media posts with AI-powered optimization.',
}

export default async function ComposePage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Get workspace ID from session or database
  // For now, we'll use a demo workspace ID
  const workspaceId = 'demo-workspace-id'

  return <PostComposer workspaceId={workspaceId} />
}