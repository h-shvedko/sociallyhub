import Link from 'next/link'
import {
  Ticket,
  Users,
  MessageSquare,
  FileText,
  Video,
  Shield,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

export default function AdminOverviewPage() {
  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-600 mt-2">
          System overview and quick access to admin functions
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Ticket className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Open Tickets</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">23</p>
                <p className="ml-2 text-sm text-green-600">
                  <TrendingUp className="inline w-4 h-4" />
                  12%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">2.4h</p>
                <p className="ml-2 text-sm text-green-600">
                  <TrendingUp className="inline w-4 h-4" />
                  8%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Active Agents</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">5</p>
                <p className="ml-2 text-sm text-gray-500">of 8</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">SLA Compliance</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">94%</p>
                <p className="ml-2 text-sm text-red-600">
                  <AlertTriangle className="inline w-4 h-4" />
                  2%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Support Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Support Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/dashboard/admin/support/tickets"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Ticket className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div>Manage Support Tickets</div>
                  <div className="text-xs text-gray-500 mt-1">
                    View, assign, and resolve support tickets
                  </div>
                </div>
                <div className="text-sm text-gray-400">23 open</div>
              </Link>

              <Link
                href="/dashboard/admin/support/agents"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="w-5 h-5 text-green-500 mr-3" />
                <div className="flex-1">
                  <div>Agent Management</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Configure agents, departments, and availability
                  </div>
                </div>
                <div className="text-sm text-gray-400">5 online</div>
              </Link>

              <Link
                href="/dashboard/admin/support/analytics"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <BarChart3 className="w-5 h-5 text-purple-500 mr-3" />
                <div className="flex-1">
                  <div>Support Analytics</div>
                  <div className="text-xs text-gray-500 mt-1">
                    View performance metrics and reports
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Content Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Content Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/dashboard/admin/content/articles"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div>Help Articles</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Create and edit help documentation
                  </div>
                </div>
                <div className="text-sm text-gray-400">42 articles</div>
              </Link>

              <Link
                href="/dashboard/admin/content/faqs"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-5 h-5 text-green-500 mr-3" />
                <div className="flex-1">
                  <div>FAQ Management</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Manage frequently asked questions
                  </div>
                </div>
                <div className="text-sm text-gray-400">28 FAQs</div>
              </Link>

              <Link
                href="/dashboard/admin/content/videos"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Video className="w-5 h-5 text-purple-500 mr-3" />
                <div className="flex-1">
                  <div>Video Tutorials</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Upload and organize video content
                  </div>
                </div>
                <div className="text-sm text-gray-400">12 videos</div>
              </Link>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              User Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/dashboard/admin/users/accounts"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div>User Accounts</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Manage user accounts and profiles
                  </div>
                </div>
                <div className="text-sm text-gray-400">1,234 users</div>
              </Link>

              <Link
                href="/dashboard/admin/users/roles"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Shield className="w-5 h-5 text-green-500 mr-3" />
                <div className="flex-1">
                  <div>Roles & Permissions</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Configure user roles and access levels
                  </div>
                </div>
                <div className="text-sm text-gray-400">8 roles</div>
              </Link>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              System Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Database</div>
                    <div className="text-xs text-gray-500">All systems operational</div>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">API Services</div>
                    <div className="text-xs text-gray-500">Response time: 120ms</div>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Email Service</div>
                    <div className="text-xs text-gray-500">Minor delays reported</div>
                  </div>
                </div>
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}