"use client"

import { ReactNode, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { PageTransition } from "@/components/ui/page-transition"
import { NotificationManager } from "@/components/support/notification-toast"
import { useSupportNotifications } from "@/hooks/use-support-notifications"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { requestNotificationPermission } = useSupportNotifications({
    enabled: true,
    pollInterval: 5000,
    onNewMessage: (message, chat) => {
      console.log('New support message received:', message.content)
    }
  })

  useEffect(() => {
    // Request notification permission on first load
    requestNotificationPermission()
  }, [])

  return (
    <NotificationManager>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <Header />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <PageTransition className="animate-fade-in">
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
    </NotificationManager>
  )
}