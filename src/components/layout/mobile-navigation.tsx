"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Menu,
  X,
  ChevronRight,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "text-blue-600" },
  { name: "Compose", href: "/dashboard/posts", icon: PenTool, color: "text-green-600" },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar, color: "text-purple-600" },
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox, color: "text-orange-600" },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, color: "text-indigo-600" },
]

const resources = [
  { name: "Assets", href: "/dashboard/assets", icon: Image, color: "text-pink-600" },
  { name: "Templates", href: "/dashboard/templates", icon: FileText, color: "text-cyan-600" },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Target, color: "text-red-600" },
  { name: "Clients", href: "/dashboard/clients", icon: Users, color: "text-emerald-600" },
]

const system = [
  { name: "Accounts", href: "/dashboard/accounts", icon: Zap, color: "text-yellow-600" },
  { name: "Team", href: "/dashboard/team", icon: Users, color: "text-violet-600" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, color: "text-slate-600" },
  { name: "Material Showcase", href: "/dashboard/showcase", icon: Palette, color: "text-rose-600" },
  { name: "Help", href: "/dashboard/help", icon: HelpCircle, color: "text-teal-600" },
]

interface MobileNavigationProps {
  className?: string
}

export function MobileNavigation({ className }: MobileNavigationProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const NavigationSection = ({ 
    items, 
    title, 
    delay = 0 
  }: { 
    items: typeof navigation
    title: string
    delay?: number
  }) => (
    <div className="space-y-2">
      <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item, index) => {
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "w-full justify-start h-12 px-3 group transition-all duration-200",
                "hover:bg-primary/10 hover:text-primary",
                "active:scale-95",
                isActive && "bg-primary/10 text-primary border-r-2 border-primary"
              )}
              style={{
                animationDelay: `${delay + index * 50}ms`
              }}
              onClick={() => setIsOpen(false)}
            >
              <Link href={item.href} className="flex items-center w-full">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-all duration-200",
                  "group-hover:scale-110",
                  isActive ? "bg-primary/20" : "bg-muted/50"
                )}>
                  <item.icon className={cn(
                    "h-4 w-4 transition-colors duration-200",
                    isActive ? "text-primary" : item.color
                  )} />
                </div>
                <span className="font-medium">{item.name}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 ml-auto transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-1",
                  isActive && "opacity-100"
                )} />
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "md:hidden relative p-2 hover:bg-primary/10 transition-all duration-200",
            "active:scale-95",
            className
          )}
        >
          <Menu className={cn(
            "h-5 w-5 transition-all duration-300",
            isOpen ? "rotate-90 scale-0" : "rotate-0 scale-100"
          )} />
          <X className={cn(
            "h-5 w-5 absolute inset-0 m-auto transition-all duration-300",
            isOpen ? "rotate-0 scale-100" : "rotate-90 scale-0"
          )} />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="left" 
        className="w-80 p-0 border-r-2 border-border/50"
      >
        <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
          {/* Header */}
          <SheetHeader className="p-6 bg-gradient-to-r from-primary/5 to-blue-600/5 border-b border-border/50">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center animate-pulse">
                <span className="text-white font-bold">S</span>
              </div>
              <div className="flex flex-col">
                <SheetTitle className="text-left text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  SociallyHub
                </SheetTitle>
                <p className="text-xs text-muted-foreground">Social Media Management</p>
              </div>
            </div>
          </SheetHeader>

          {/* Navigation Content */}
          <ScrollArea className="flex-1 px-4 py-6">
            <div className="space-y-8 animate-in slide-in-from-left-5 duration-300">
              <NavigationSection items={navigation} title="Main Navigation" delay={0} />
              <Separator className="opacity-50" />
              <NavigationSection items={resources} title="Resources" delay={250} />
              <Separator className="opacity-50" />
              <NavigationSection items={system} title="System" delay={500} />
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-border/50 bg-muted/20">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                SociallyHub v1.0
              </p>
              <p className="text-xs text-muted-foreground/70">
                © 2024 All rights reserved
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}