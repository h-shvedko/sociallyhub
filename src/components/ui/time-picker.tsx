'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TimePickerProps {
  value: string // HH:mm format
  onChange: (time: string) => void
  className?: string
  disabled?: boolean
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
  const [hours, minutes] = value.split(':')

  const handleHoursChange = (newHours: string) => {
    onChange(`${newHours.padStart(2, '0')}:${minutes}`)
  }

  const handleMinutesChange = (newMinutes: string) => {
    onChange(`${hours}:${newMinutes.padStart(2, '0')}`)
  }

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0')
  }))

  const minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0')
  }))

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select
        value={hours}
        onValueChange={handleHoursChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {hourOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <span className="flex items-center text-muted-foreground">:</span>
      
      <Select
        value={minutes}
        onValueChange={handleMinutesChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {minuteOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}