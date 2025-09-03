"use client"

import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns"
import { ChevronLeft, ChevronRight, Grid, List, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CalendarView = 'month' | 'week' | 'day'

interface CalendarHeaderProps {
  currentView: CalendarView
  setCurrentView: (view: CalendarView) => void
  currentDate: Date
  setCurrentDate: (date: Date) => void
}

export function CalendarHeader({ 
  currentView, 
  setCurrentView, 
  currentDate, 
  setCurrentDate 
}: CalendarHeaderProps) {
  
  const navigateDate = (direction: 'prev' | 'next') => {
    let newDate: Date
    
    switch (currentView) {
      case 'month':
        newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
        break
      case 'week':
        newDate = direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)
        break
      case 'day':
        newDate = direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1)
        break
      default:
        newDate = currentDate
    }
    
    setCurrentDate(newDate)
  }

  const getDateDisplayFormat = () => {
    switch (currentView) {
      case 'month':
        return 'MMMM yyyy'
      case 'week':
        return 'MMM dd, yyyy'
      case 'day':
        return 'EEEE, MMM dd, yyyy'
      default:
        return 'MMM yyyy'
    }
  }

  return (
    <Card className="shadow-md">
      <div className="flex items-center justify-between p-4">
        {/* Date Navigation */}
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('prev')}
            className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-xl font-semibold min-w-[200px] text-center">
            {format(currentDate, getDateDisplayFormat())}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('next')}
            className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="ml-4 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            Today
          </Button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-muted/30 rounded-lg p-1">
          <Button
            variant={currentView === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('month')}
            className={cn(
              "h-8 px-3 transition-all duration-200",
              currentView === 'month' 
                ? "shadow-sm" 
                : "hover:bg-primary/10 hover:text-primary"
            )}
          >
            <Grid className="h-4 w-4 mr-1" />
            Month
          </Button>
          <Button
            variant={currentView === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('week')}
            className={cn(
              "h-8 px-3 transition-all duration-200",
              currentView === 'week' 
                ? "shadow-sm" 
                : "hover:bg-primary/10 hover:text-primary"
            )}
          >
            <List className="h-4 w-4 mr-1" />
            Week
          </Button>
          <Button
            variant={currentView === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('day')}
            className={cn(
              "h-8 px-3 transition-all duration-200",
              currentView === 'day' 
                ? "shadow-sm" 
                : "hover:bg-primary/10 hover:text-primary"
            )}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Day
          </Button>
        </div>
      </div>
    </Card>
  )
}