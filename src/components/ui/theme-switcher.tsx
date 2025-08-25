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

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = React.useState("professional-ocean")

  React.useEffect(() => {
    // Get initial theme from root element
    const root = document.documentElement
    const theme = root.getAttribute("data-theme") || "professional-ocean"
    setCurrentTheme(theme)
  }, [])

  const handleThemeChange = (theme: string) => {
    const root = document.documentElement
    root.setAttribute("data-theme", theme)
    setCurrentTheme(theme)
    
    // Store theme preference
    localStorage.setItem("theme", theme)
  }

  React.useEffect(() => {
    // Apply saved theme on mount
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme && themes.find(t => t.value === savedTheme)) {
      handleThemeChange(savedTheme)
    }
  }, [])

  const currentThemeData = themes.find(t => t.value === currentTheme)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Switch theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="p-2">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Material Design Themes
          </div>
          {themes.map((theme) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => handleThemeChange(theme.value)}
              className={cn(
                "flex flex-col items-start gap-2 p-3 cursor-pointer rounded-md",
                currentTheme === theme.value && "bg-accent"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{theme.name}</div>
                  {currentTheme === theme.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {theme.description}
              </div>
              <div className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div 
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: theme.colors.secondary }}
                />
                <div 
                  className="w-3 h-3 rounded-full border border-border"
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