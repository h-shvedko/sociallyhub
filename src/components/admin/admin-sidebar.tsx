'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Ticket,
  Users,
  MessageSquare,
  BarChart3,
  FileText,
  Shield,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Eye,
  UserPlus,
  KeyRound,
  Mail,
  Globe,
  Database,
  Flag
} from 'lucide-react'

interface AdminSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
}

// Only link pages that actually exist. The former Role Management and
// Permission Matrix pages were deleted (ADR-0004/ADR-0012); /users/roles is
// now a static read-only reference for the five WorkspaceRole values.
const navigation: NavItem[] = [
  {
    name: 'Overview',
    href: '/dashboard/admin',
    icon: LayoutDashboard
  },
  {
    name: 'Support',
    href: '/dashboard/admin/support',
    icon: MessageSquare,
    children: [
      { name: 'Tickets', href: '/dashboard/admin/support/tickets', icon: Ticket },
      { name: 'Agents', href: '/dashboard/admin/support/agents', icon: Users }
    ]
  },
  {
    name: 'Content',
    href: '/dashboard/admin/content',
    icon: FileText,
    children: [
      { name: 'Articles', href: '/dashboard/admin/content/articles', icon: FileText }
    ]
  },
  {
    name: 'User Management',
    href: '/dashboard/admin/users',
    icon: Users,
    children: [
      { name: 'User Administration', href: '/dashboard/admin/users/administration', icon: Users },
      { name: 'Roles reference', href: '/dashboard/admin/users/roles', icon: Shield },
      { name: 'User Analytics', href: '/dashboard/admin/users/analytics', icon: BarChart3 },
      { name: 'Access Logs', href: '/dashboard/admin/users/access-logs', icon: Eye },
      { name: 'Bulk Operations', href: '/dashboard/admin/users/bulk-operations', icon: UserPlus }
    ]
  },
  {
    name: 'Settings',
    href: '/dashboard/admin/settings',
    icon: Settings,
    children: [
      { name: 'Settings Hub', href: '/dashboard/admin/settings', icon: Settings },
      { name: 'System Configuration', href: '/dashboard/admin/settings/system', icon: Settings },
      { name: 'Email Templates', href: '/dashboard/admin/settings/email-templates', icon: Mail },
      { name: 'Integrations', href: '/dashboard/admin/settings/integrations', icon: Globe },
      { name: 'Backup & Recovery', href: '/dashboard/admin/settings/backup', icon: Database },
      { name: 'Feature Flags', href: '/dashboard/admin/settings/feature-flags', icon: Flag },
      { name: 'Single Sign-On', href: '/dashboard/admin/settings/sso', icon: KeyRound }
    ]
  }
]

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href)
        ? prev.filter(item => item !== href)
        : [...prev, href]
    )
  }

  const isActive = (href: string) => {
    if (href === '/dashboard/admin' || href === '/dashboard/admin/settings') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const isExpanded = (href: string) => {
    return expandedItems.includes(href) || pathname.startsWith(href)
  }

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Admin Panel</h2>
          <Link
            href="/dashboard"
            className="p-1 rounded hover:bg-gray-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-1">System Administration</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpanded(item.href)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive(item.href)
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </div>
                  {isExpanded(item.href) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {isExpanded(item.href) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={`
                          flex items-center px-3 py-2 text-sm rounded-md transition-colors
                          ${isActive(child.href)
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }
                        `}
                      >
                        <child.icon className="mr-3 h-3 w-3" />
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                href={item.href}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive(item.href)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.name}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium">
                {user.name?.charAt(0) || 'A'}
              </span>
            </div>
          )}
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.name || 'Admin'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              Platform administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
