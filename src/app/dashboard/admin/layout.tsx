import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import AdminSidebar from '@/components/admin/admin-sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const userId = normalizeUserId(session.user.id)

  // Verify user has admin permissions
  const userWorkspaces = await prisma.userWorkspace.findMany({
    where: {
      userId,
      role: { in: ['OWNER', 'ADMIN'] }
    },
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: {
          name: true
        }
      }
    }
  })

  if (userWorkspaces.length === 0) {
    redirect('/dashboard')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <AdminSidebar
        userWorkspaces={userWorkspaces}
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Admin Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Administration Panel
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage support, content, and system settings
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  {userWorkspaces.length} workspace{userWorkspaces.length !== 1 ? 's' : ''}
                </span>
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}