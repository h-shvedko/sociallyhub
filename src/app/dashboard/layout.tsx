"use client"

import { ReactNode } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-md-background">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-md-primary/20 animate-pulse"></div>
            <div className="absolute top-2 left-2 h-12 w-12 rounded-full border-4 border-md-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="text-body-large text-md-on-surface-variant">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/auth/signin")
  }

  return <DashboardLayout>{children}</DashboardLayout>
}