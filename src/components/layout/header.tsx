"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Bell, ChevronDown, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { LanguageSelector } from "@/components/ui/language-selector"
import { MobileNavigation } from "./mobile-navigation"

interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6 sticky top-0 z-40 transition-all duration-200">
      {/* Left side - Mobile Navigation + Search */}
      <div className="flex items-center space-x-2 sm:space-x-4 flex-1">
        {/* Mobile Navigation */}
        <MobileNavigation />

        {/* Search - Hidden on mobile, shown on tablet and up */}
        <div className="hidden sm:block relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
          <Input
            placeholder="Search posts, accounts, campaigns..."
            className="pl-9 bg-muted/50 border-0 focus:bg-background transition-all duration-200 hover:bg-muted/70"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Mobile Search Toggle */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="sm:hidden p-2 hover:bg-primary/10 transition-all duration-200 active:scale-95"
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>

        {/* Quick Actions - Compose */}
        <Button 
          variant="outline" 
          size="sm"
          className="hidden sm:flex items-center space-x-2 hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">Compose</span>
        </Button>

        {/* Mobile Compose */}
        <Button 
          variant="outline" 
          size="sm"
          className="sm:hidden p-2 hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">Compose</span>
        </Button>

        {/* Language Selector - Hidden on mobile */}
        <div className="hidden sm:flex items-center">
          <LanguageSelector variant="compact" />
        </div>

        {/* Theme Switcher - Hidden on mobile */}
        <div className="hidden sm:flex items-center">
          <ThemeSwitcher />
        </div>

        {/* Notifications */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2 hover:bg-primary/10 transition-all duration-200 active:scale-95"
        >
          <Bell className="h-4 w-4 transition-transform hover:rotate-12" />
          <Badge 
            variant="destructive" 
            className="absolute -right-1 -top-1 h-5 w-5 p-0 text-xs animate-pulse"
          >
            3
          </Badge>
          <span className="sr-only">Notifications</span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-8 w-8 rounded-full hover:ring-2 hover:ring-primary/20 transition-all duration-200 active:scale-95"
            >
              <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-primary/30 transition-all duration-200">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-sm font-semibold">
                  {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-64 animate-in slide-in-from-top-2 duration-200" 
            align="end" 
            forceMount
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">
                  {session?.user?.name || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Mobile-only Language & Theme Switcher */}
            <div className="sm:hidden px-2 py-1">
              <div className="flex flex-col space-y-3">
                <div className="flex flex-col space-y-2">
                  <span className="text-sm font-medium">Language</span>
                  <LanguageSelector variant="compact" />
                </div>
                <div className="flex flex-col space-y-2">
                  <span className="text-sm font-medium">Theme</span>
                  <ThemeSwitcher variant="compact" />
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="sm:hidden" />
            
            <DropdownMenuItem 
              onClick={() => router.push('/dashboard/profile')}
              className="cursor-pointer hover:bg-primary/10 transition-colors duration-200"
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push('/dashboard/workspace')}
              className="cursor-pointer hover:bg-primary/10 transition-colors duration-200"
            >
              Switch Workspace
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push('/dashboard/billing')}
              className="cursor-pointer hover:bg-primary/10 transition-colors duration-200"
            >
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push('/dashboard/settings')}
              className="cursor-pointer hover:bg-primary/10 transition-colors duration-200"
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-200"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}