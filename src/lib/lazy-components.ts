import dynamic from 'next/dynamic'
import { ComponentType } from 'react'

// Loading component for lazy-loaded components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
  </div>
)

// Analytics components - lazy loaded to reduce initial bundle
export const AnalyticsDashboard = dynamic(
  () => import('@/components/dashboard/analytics/analytics-dashboard'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const AnalyticsOverviewCards = dynamic(
  () => import('@/components/dashboard/analytics/analytics-overview-cards'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const ChartComponents = dynamic(
  () => import('@/components/dashboard/analytics/chart-components'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const EngagementMetrics = dynamic(
  () => import('@/components/dashboard/analytics/engagement-metrics'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const PerformanceComparison = dynamic(
  () => import('@/components/dashboard/analytics/performance-comparison'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const ExportableReports = dynamic(
  () => import('@/components/dashboard/analytics/exportable-reports'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const RealTimeUpdates = dynamic(
  () => import('@/components/dashboard/analytics/real-time-updates'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const CustomDashboardWidgets = dynamic(
  () => import('@/components/dashboard/analytics/custom-dashboard-widgets'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Team components - lazy loaded
export const TeamInvitationSystem = dynamic(
  () => import('@/components/dashboard/team/team-invitation-system'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const RolePermissionInterface = dynamic(
  () => import('@/components/dashboard/team/role-permission-interface'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const ApprovalWorkflow = dynamic(
  () => import('@/components/dashboard/team/approval-workflow'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const TeamActivityFeed = dynamic(
  () => import('@/components/dashboard/team/team-activity-feed'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const CollaborativePostEditor = dynamic(
  () => import('@/components/dashboard/team/collaborative-post-editor'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const TeamPerformanceMetrics = dynamic(
  () => import('@/components/dashboard/team/team-performance-metrics'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Calendar components - lazy loaded
export const ContentCalendar = dynamic(
  () => import('@/components/dashboard/calendar/content-calendar'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const BulkScheduling = dynamic(
  () => import('@/components/dashboard/calendar/bulk-scheduling'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const CalendarExportImport = dynamic(
  () => import('@/components/dashboard/calendar/calendar-export-import'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const RecurringPostTemplates = dynamic(
  () => import('@/components/dashboard/calendar/recurring-post-templates'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Notification components - lazy loaded
export const NotificationCenter = dynamic(
  () => import('@/components/notifications/notification-center'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const NotificationPreferences = dynamic(
  () => import('@/components/notifications/notification-preferences'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Monitoring components - lazy loaded
export const MonitoringDashboard = dynamic(
  () => import('@/components/dashboard/monitoring/monitoring-dashboard'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const JobsMonitoring = dynamic(
  () => import('@/components/dashboard/jobs/jobs-monitoring'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Recharts components - lazy loaded to reduce bundle size
export const RechartsComponents = {
  LineChart: dynamic(() => import('recharts').then(mod => ({ default: mod.LineChart })), {
    loading: LoadingSpinner,
    ssr: false
  }),
  AreaChart: dynamic(() => import('recharts').then(mod => ({ default: mod.AreaChart })), {
    loading: LoadingSpinner,
    ssr: false
  }),
  BarChart: dynamic(() => import('recharts').then(mod => ({ default: mod.BarChart })), {
    loading: LoadingSpinner,
    ssr: false
  }),
  PieChart: dynamic(() => import('recharts').then(mod => ({ default: mod.PieChart })), {
    loading: LoadingSpinner,
    ssr: false
  }),
  ComposedChart: dynamic(() => import('recharts').then(mod => ({ default: mod.ComposedChart })), {
    loading: LoadingSpinner,
    ssr: false
  })
}

// Third-party components that should be lazy loaded
export const DatePicker = dynamic(
  () => import('react-datepicker'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Heavy UI components
export const DataTable = dynamic(
  () => import('@/components/ui/data-table'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

export const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor'),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
)

// Type-safe component loader with error boundary
export function createLazyComponent<T = any>(
  componentImport: () => Promise<{ default: ComponentType<T> }>,
  options?: {
    loading?: ComponentType
    error?: ComponentType<{ error: Error; retry: () => void }>
    ssr?: boolean
  }
) {
  return dynamic(componentImport, {
    loading: options?.loading || LoadingSpinner,
    ssr: options?.ssr ?? true
  })
}

// Bundle splitting utilities
export const splitByRoute = {
  dashboard: () => import('@/app/dashboard/page'),
  analytics: () => import('@/app/dashboard/analytics/page'),
  team: () => import('@/app/dashboard/team/page'),
  calendar: () => import('@/app/dashboard/calendar/page'),
  posts: () => import('@/app/dashboard/posts/page'),
  settings: () => import('@/app/dashboard/settings/page')
}

export default {
  // Analytics
  AnalyticsDashboard,
  AnalyticsOverviewCards,
  ChartComponents,
  EngagementMetrics,
  PerformanceComparison,
  ExportableReports,
  RealTimeUpdates,
  CustomDashboardWidgets,
  
  // Team
  TeamInvitationSystem,
  RolePermissionInterface,
  ApprovalWorkflow,
  TeamActivityFeed,
  CollaborativePostEditor,
  TeamPerformanceMetrics,
  
  // Calendar
  ContentCalendar,
  BulkScheduling,
  CalendarExportImport,
  RecurringPostTemplates,
  
  // Notifications
  NotificationCenter,
  NotificationPreferences,
  
  // Monitoring
  MonitoringDashboard,
  JobsMonitoring,
  
  // Charts
  RechartsComponents,
  
  // Utilities
  createLazyComponent,
  splitByRoute
}