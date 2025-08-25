"use client"

import * as React from "react"
import { Check, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const themes = [
  {
    name: "Professional Ocean",
    value: "professional-ocean",
    description: "Trust and reliability for business",
    colors: {
      primary: "hsl(214, 88%, 51%)",
      secondary: "hsl(43, 74%, 66%)",
      accent: "hsl(260, 24%, 57%)",
    }
  },
  {
    name: "Creative Sunrise",
    value: "creative-sunrise", 
    description: "Energy and creativity for content creators",
    colors: {
      primary: "hsl(14, 88%, 55%)",
      secondary: "hsl(280, 65%, 60%)",
      accent: "hsl(340, 75%, 55%)",
    }
  },
  {
    name: "Modern Forest",
    value: "modern-forest",
    description: "Growth and sustainability focus",
    colors: {
      primary: "hsl(142, 69%, 42%)",
      secondary: "hsl(43, 96%, 56%)",
      accent: "hsl(32, 78%, 68%)",
    }
  },
]

interface ThemeSwitcherProps {
  variant?: "full" | "compact"
  className?: string
}

export function ThemeSwitcher({ variant = "full", className }: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = React.useState("professional-ocean")

  React.useEffect(() => {
    // Get initial theme from root element
    const root = document.documentElement
    const theme = root.getAttribute("data-theme") || "professional-ocean"
    setCurrentTheme(theme)
  }, [])

  const handleThemeChange = (theme: string) => {
    const root = document.documentElement
    
    // Add transition class for smooth theme switching
    root.classList.add("theme-transitioning")
    
    root.setAttribute("data-theme", theme)
    setCurrentTheme(theme)
    
    // Store theme preference
    localStorage.setItem("theme", theme)
    
    // Remove transition class after animation
    setTimeout(() => {
      root.classList.remove("theme-transitioning")
    }, 300)
  }

  React.useEffect(() => {
    // Apply saved theme on mount
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme && themes.find(t => t.value === savedTheme)) {
      handleThemeChange(savedTheme)
    }
  }, [])

  const currentThemeData = themes.find(t => t.value === currentTheme)

  // Compact variant for mobile dropdown
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col space-y-1", className)}>
        {themes.map((theme) => (
          <button
            key={theme.value}
            onClick={() => handleThemeChange(theme.value)}
            className={cn(
              "flex items-center justify-between w-full p-2 text-sm rounded-md transition-all duration-200",
              "hover:bg-muted/50 active:scale-95",
              currentTheme === theme.value && "bg-primary/10 text-primary"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full border border-border/50"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div 
                  className="w-2 h-2 rounded-full border border-border/50"
                  style={{ backgroundColor: theme.colors.secondary }}
                />
              </div>
              <span>{theme.name}</span>
            </div>
            {currentTheme === theme.value && (
              <Check className="h-3 w-3" />
            )}
          </button>
        ))}
      </div>
    )
  }

  // Full variant for desktop
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "relative hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 active:scale-95",
            className
          )}
        >
          <Palette className="h-4 w-4 transition-transform hover:rotate-12" />
          <span className="sr-only">Switch theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 animate-in slide-in-from-top-2 duration-200">
        <div className="p-2">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Material Design Themes
          </div>
          {themes.map((theme, index) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => handleThemeChange(theme.value)}
              className={cn(
                "flex flex-col items-start gap-2 p-3 cursor-pointer rounded-md transition-all duration-200",
                "hover:bg-primary/10 active:scale-98",
                currentTheme === theme.value && "bg-primary/10 border border-primary/20"
              )}
              style={{
                animationDelay: `${index * 50}ms`
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{theme.name}</div>
                  {currentTheme === theme.value && (
                    <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {theme.description}
              </div>
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-full border border-border/50 transition-transform hover:scale-110"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div 
                  className="w-3 h-3 rounded-full border border-border/50 transition-transform hover:scale-110"
                  style={{ backgroundColor: theme.colors.secondary }}
                />
                <div 
                  className="w-3 h-3 rounded-full border border-border/50 transition-transform hover:scale-110"
                  style={{ backgroundColor: theme.colors.accent }}
                />
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}