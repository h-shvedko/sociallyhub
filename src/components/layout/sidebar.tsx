"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  PenTool,
  Calendar,
  Inbox,
  BarChart3,
  Image,
  FileText,
  Target,
  Users,
  Settings,
  HelpCircle,
  Zap,
  Palette,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Compose", href: "/dashboard/compose", icon: PenTool },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
]

const resources = [
  { name: "Assets", href: "/dashboard/assets", icon: Image },
  { name: "Templates", href: "/dashboard/templates", icon: FileText },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Target },
  { name: "Clients", href: "/dashboard/clients", icon: Users },
]

const system = [
  { name: "Accounts", href: "/dashboard/accounts", icon: Zap },
  { name: "Team", href: "/dashboard/team", icon: Users },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Material Showcase", href: "/dashboard/showcase", icon: Palette },
  { name: "Help", href: "/dashboard/help", icon: HelpCircle },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("flex h-full w-64 flex-col bg-muted/50", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded bg-primary" />
          <span className="text-lg font-semibold">SociallyHub</span>
        </Link>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary"
                )}
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            )
          })}
        </div>

        <Separator className="my-4" />

        {/* Resources */}
        <div className="space-y-1">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resources
          </h3>
          {resources.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary"
                )}
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            )
          })}
        </div>

        <Separator className="my-4" />

        {/* System */}
        <div className="space-y-1">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            System
          </h3>
          {system.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary"
                )}
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}