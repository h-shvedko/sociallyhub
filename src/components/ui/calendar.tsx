"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

export interface CalendarProps {
  className?: string
  classNames?: {
    months?: string
    month?: string
    caption?: string
    caption_label?: string
    nav?: string
    nav_button?: string
    nav_button_previous?: string
    nav_button_next?: string
    table?: string
    head_row?: string
    head_cell?: string
    row?: string
    cell?: string
    day?: string
    day_selected?: string
    day_today?: string
    day_outside?: string
    day_disabled?: string
    day_range_middle?: string
    day_hidden?: string
  }
  showOutsideDays?: boolean
  mode?: "single" | "multiple" | "range"
  selected?: Date | Date[] | { from: Date | undefined; to: Date | undefined }
  onSelect?: (date: any) => void
  defaultMonth?: Date
  numberOfMonths?: number
  initialFocus?: boolean
  disabled?: (date: Date) => boolean
  fromYear?: number
  toYear?: number
  fromMonth?: Date
  toMonth?: Date
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  mode = "single",
  selected,
  onSelect,
  defaultMonth,
  numberOfMonths = 1,
  initialFocus,
  disabled,
  fromYear,
  toYear,
  fromMonth,
  toMonth,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    defaultMonth || new Date()
  )
  
  const today = new Date()
  
  // Get days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }
  
  // Get first day of month (0 = Sunday)
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }
  
  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }
  
  // Check if date is selected
  const isSelected = (date: Date) => {
    if (!selected) return false
    
    if (mode === "single") {
      return selected instanceof Date && 
        date.getTime() === selected.getTime()
    }
    
    if (mode === "multiple") {
      return Array.isArray(selected) && 
        selected.some(d => d.getTime() === date.getTime())
    }
    
    if (mode === "range" && typeof selected === "object" && "from" in selected) {
      const { from, to } = selected
      if (from && to) {
        return date >= from && date <= to
      }
      if (from) {
        return date.getTime() === from.getTime()
      }
    }
    
    return false
  }
  
  // Check if date is in range middle
  const isInRangeMiddle = (date: Date) => {
    if (mode !== "range" || typeof selected !== "object" || !("from" in selected)) return false
    const { from, to } = selected
    if (!from || !to) return false
    return date > from && date < to
  }
  
  // Check if date is today
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }
  
  // Handle date click
  const handleDateClick = (date: Date) => {
    if (disabled?.(date)) return
    
    if (mode === "single") {
      onSelect?.(date)
    } else if (mode === "multiple") {
      const current = Array.isArray(selected) ? selected : []
      const existing = current.findIndex(d => d.getTime() === date.getTime())
      if (existing >= 0) {
        onSelect?.(current.filter((_, i) => i !== existing))
      } else {
        onSelect?.([...current, date])
      }
    } else if (mode === "range") {
      const current = typeof selected === "object" && selected && "from" in selected ? selected : { from: undefined, to: undefined }
      if (!current.from || (current.from && current.to)) {
        onSelect?.({ from: date, to: undefined })
      } else if (date < current.from) {
        onSelect?.({ from: date, to: current.from })
      } else {
        onSelect?.({ from: current.from, to: date })
      }
    }
  }
  
  // Render calendar month
  const renderMonth = (monthDate: Date, monthIndex: number) => {
    const daysInMonth = getDaysInMonth(monthDate)
    const firstDay = getFirstDayOfMonth(monthDate)
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    const days = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      const prevMonthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 
        getDaysInMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1)) - firstDay + i + 1)
      
      days.push(
        <button
          key={`empty-${i}`}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal text-muted-foreground",
            classNames?.day,
            classNames?.day_outside
          )}
          onClick={() => showOutsideDays && handleDateClick(prevMonthDate)}
          disabled={!showOutsideDays}
        >
          {showOutsideDays ? prevMonthDate.getDate() : ''}
        </button>
      )
    }
    
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      const selected = isSelected(date)
      const today = isToday(date)
      const inRangeMiddle = isInRangeMiddle(date)
      const isDisabled = disabled?.(date) || false
      
      days.push(
        <button
          key={day}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal",
            today && "bg-accent text-accent-foreground",
            selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            inRangeMiddle && "bg-accent text-accent-foreground",
            isDisabled && "text-muted-foreground opacity-50",
            classNames?.day,
            selected && classNames?.day_selected,
            today && classNames?.day_today,
            isDisabled && classNames?.day_disabled,
            inRangeMiddle && classNames?.day_range_middle
          )}
          onClick={() => handleDateClick(date)}
          disabled={isDisabled}
        >
          {day}
        </button>
      )
    }
    
    return (
      <div key={monthIndex} className={cn("space-y-4", classNames?.month)}>
        <div className={cn("flex justify-between items-center", classNames?.caption)}>
          {monthIndex === 0 && (
            <Button
              variant="outline"
              size="icon"
              className={cn("h-7 w-7", classNames?.nav_button, classNames?.nav_button_previous)}
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className={cn("text-sm font-medium", classNames?.caption_label)}>
            {monthName}
          </div>
          {monthIndex === numberOfMonths - 1 && (
            <Button
              variant="outline"
              size="icon"
              className={cn("h-7 w-7", classNames?.nav_button, classNames?.nav_button_next)}
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <table className={cn("w-full border-collapse space-y-1", classNames?.table)}>
          <thead>
            <tr className={classNames?.head_row}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <th
                  key={day}
                  className={cn(
                    "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                    classNames?.head_cell
                  )}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => (
              <tr key={weekIndex} className={classNames?.row}>
                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => (
                  <td key={dayIndex} className={cn("text-center text-sm p-0 relative", classNames?.cell)}>
                    {day}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  
  const months = Array.from({ length: numberOfMonths }, (_, i) => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i)
  })
  
  return (
    <div className={cn("p-3", className)} {...props}>
      <div className={cn("flex", numberOfMonths > 1 && "space-x-4", classNames?.months)}>
        {months.map((month, index) => renderMonth(month, index))}
      </div>
    </div>
  )
}