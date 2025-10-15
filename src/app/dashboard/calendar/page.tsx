"use client"

import { useState } from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Grid, List, Plus, Upload, Download, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarGrid } from "@/components/dashboard/calendar/calendar-grid"
import { CalendarHeader } from "@/components/dashboard/calendar/calendar-header"
import { PostScheduler } from "@/components/dashboard/calendar/post-scheduler"
import { BulkScheduler } from "@/components/dashboard/calendar/bulk-scheduler"
import { CalendarExportImport } from "@/components/dashboard/calendar/calendar-export-import"
import { RecurringPostTemplates } from "@/components/dashboard/calendar/recurring-post-templates"

type CalendarView = 'month' | 'week' | 'day'

interface Post {
  id: string
  title: string
  baseContent?: any  // The actual content from API
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  scheduledAt: string | null
  platforms: string[]
}

export default function CalendarPage() {
  const [currentView, setCurrentView] = useState<CalendarView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showScheduler, setShowScheduler] = useState(false)
  const [showBulkScheduler, setShowBulkScheduler] = useState(false)
  const [showExportImport, setShowExportImport] = useState(false)
  const [showRecurringTemplates, setShowRecurringTemplates] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  const handlePostClick = (post: Post) => {
    setEditingPost(post)
    setShowScheduler(true)
  }

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date)
    setEditingPost(null) // Clear any editing post
    setShowScheduler(true)
  }

  const handleCloseScheduler = () => {
    setShowScheduler(false)
    setEditingPost(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Content Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Schedule and manage your social media posts
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditingPost(null)
              setShowScheduler(true)
            }}
            className="shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Post
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowBulkScheduler(true)}
            className="shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Schedule
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowRecurringTemplates(true)}
            className="shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            <Repeat className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowExportImport(true)}
            className="shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            <Download className="h-4 w-4 mr-2" />
            Export/Import
          </Button>
        </div>
      </div>

      {/* Calendar Header Controls */}
      <CalendarHeader 
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
      />

      {/* Calendar Grid */}
      <CalendarGrid
        view={currentView}
        currentDate={currentDate}
        onDateSelect={handleDateSelect}
        onPostClick={handlePostClick}
      />

      {/* Post Scheduler Modal */}
      <PostScheduler
        isOpen={showScheduler}
        onClose={handleCloseScheduler}
        initialDate={currentDate}
        editPost={editingPost}
      />

      {/* Bulk Scheduler Modal */}
      <BulkScheduler 
        isOpen={showBulkScheduler}
        onClose={() => setShowBulkScheduler(false)}
      />

      {/* Export/Import Modal */}
      <CalendarExportImport 
        isOpen={showExportImport}
        onClose={() => setShowExportImport(false)}
      />

      {/* Recurring Templates Modal */}
      <RecurringPostTemplates 
        isOpen={showRecurringTemplates}
        onClose={() => setShowRecurringTemplates(false)}
      />
    </div>
  )
}