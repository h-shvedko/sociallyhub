import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { HelpCenter } from '@/components/dashboard/help/help-center'

export const metadata: Metadata = {
  title: 'Help Center | SociallyHub',
  description: 'Get help, tutorials, and support for using SociallyHub effectively.',
}

export default async function HelpPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  return <HelpCenter />
}