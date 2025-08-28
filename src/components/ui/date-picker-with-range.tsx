"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerWithRangeProps {
  className?: string
  placeholder?: string
  from?: Date
  to?: Date
  onSelect?: (range: { from: Date | undefined; to: Date | undefined }) => void
}

export function DatePickerWithRange({
  className,
  placeholder = "Pick a date range",
  from,
  to,
  onSelect,
}: DatePickerWithRangeProps) {
  const [date, setDate] = React.useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from,
    to,
  })

  React.useEffect(() => {
    setDate({ from, to })
  }, [from, to])

  const handleSelect = (selectedDate: { from: Date | undefined; to: Date | undefined } | undefined) => {
    const newRange = selectedDate || { from: undefined, to: undefined }
    setDate(newRange)
    onSelect?.(newRange)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date.from ? (
              date.to ? (
                <>
                  {date.from.toLocaleDateString()} -{" "}
                  {date.to.toLocaleDateString()}
                </>
              ) : (
                date.from.toLocaleDateString()
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}