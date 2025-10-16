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
  Bot,
  Shield,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Posts", href: "/dashboard/posts", icon: PenTool },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Automation", href: "/dashboard/automation", icon: Bot },
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
  { name: "Admin", href: "/dashboard/admin", icon: Shield },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("hidden md:flex h-full w-64 flex-col bg-gradient-to-b from-muted/30 to-muted/50 border-r border-border/50", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border/30">
        <Link href="/dashboard" className="flex items-center space-x-3 group">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent group-hover:from-primary group-hover:to-blue-600 transition-all duration-200">
            SociallyHub
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navigation.map((item, index) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={cn(
                  "w-full justify-start h-11 px-3 group transition-all duration-200",
                  "hover:bg-primary/10 hover:text-primary hover:shadow-sm",
                  "active:scale-98",
                  isActive && "bg-primary/10 text-primary border-r-2 border-primary shadow-sm"
                )}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                <Link href={item.href} className="flex items-center w-full">
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg mr-3 transition-all duration-200",
                    "group-hover:scale-110 group-hover:rotate-3",
                    isActive ? "bg-primary/20 shadow-sm" : "bg-muted/30"
                  )}>
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors duration-200",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                  </div>
                  <span className="font-medium">{item.name}</span>
                </Link>
              </Button>
            )
          })}
        </div>

        <Separator className="my-4 opacity-50" />

        {/* Resources */}
        <div className="space-y-2">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resources
          </h3>
          <div className="space-y-1">
            {resources.map((item, index) => {
              const isActive = pathname === item.href
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-11 px-3 group transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary hover:shadow-sm",
                    "active:scale-98",
                    isActive && "bg-primary/10 text-primary border-r-2 border-primary shadow-sm"
                  )}
                  style={{
                    animationDelay: `${250 + index * 50}ms`
                  }}
                >
                  <Link href={item.href} className="flex items-center w-full">
                    <div className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg mr-3 transition-all duration-200",
                      "group-hover:scale-110 group-hover:rotate-3",
                      isActive ? "bg-primary/20 shadow-sm" : "bg-muted/30"
                    )}>
                      <item.icon className={cn(
                        "h-4 w-4 transition-colors duration-200",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                      )} />
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>

        <Separator className="my-4 opacity-50" />

        {/* System */}
        <div className="space-y-2">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            System
          </h3>
          <div className="space-y-1">
            {system.map((item, index) => {
              const isActive = pathname === item.href
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-11 px-3 group transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary hover:shadow-sm",
                    "active:scale-98",
                    isActive && "bg-primary/10 text-primary border-r-2 border-primary shadow-sm"
                  )}
                  style={{
                    animationDelay: `${500 + index * 50}ms`
                  }}
                >
                  <Link href={item.href} className="flex items-center w-full">
                    <div className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg mr-3 transition-all duration-200",
                      "group-hover:scale-110 group-hover:rotate-3",
                      isActive ? "bg-primary/20 shadow-sm" : "bg-muted/30"
                    )}>
                      <item.icon className={cn(
                        "h-4 w-4 transition-colors duration-200",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                      )} />
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/30 bg-muted/20">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            SociallyHub v1.0
          </p>
        </div>
      </div>
    </div>
  )
}