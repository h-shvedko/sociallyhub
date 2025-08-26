"use client"

import { useState } from "react"
import { Download, Upload, FileText, Calendar as CalendarIcon } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"

interface CalendarExportImportProps {
  isOpen: boolean
  onClose: () => void
}

interface Post {
  id: string
  title: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  scheduledAt: string | null
  platforms: string[]
  baseContent: string
}

export function CalendarExportImport({ isOpen, onClose }: CalendarExportImportProps) {
  const [mode, setMode] = useState<'export' | 'import'>('export')
  const [exportFormat, setExportFormat] = useState<'csv' | 'ical' | 'json'>('csv')
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month')
  const [loading, setLoading] = useState(false)

  const exportPosts = async () => {
    setLoading(true)
    try {
      // Fetch posts based on date range
      const response = await fetch('/api/posts')
      if (!response.ok) throw new Error('Failed to fetch posts')
      
      const data = await response.json()
      const posts: Post[] = data.posts || []

      // Filter by date range
      const now = new Date()
      const filteredPosts = posts.filter(post => {
        if (!post.scheduledAt) return false
        
        const postDate = new Date(post.scheduledAt)
        const monthsToSubtract = dateRange === 'month' ? 1 : 
                                dateRange === 'quarter' ? 3 :
                                dateRange === 'year' ? 12 : 0
        
        if (dateRange === 'all') return true
        
        const cutoffDate = new Date(now)
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsToSubtract)
        
        return postDate >= cutoffDate
      })

      if (exportFormat === 'csv') {
        exportToCSV(filteredPosts)
      } else if (exportFormat === 'ical') {
        exportToiCal(filteredPosts)
      } else if (exportFormat === 'json') {
        exportToJSON(filteredPosts)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = (posts: Post[]) => {
    const headers = ['Title', 'Content', 'Status', 'Scheduled Date', 'Scheduled Time', 'Platforms']
    const rows = posts.map(post => [
      post.title || 'Untitled',
      post.baseContent?.replace(/"/g, '""') || '', // Escape quotes
      post.status,
      post.scheduledAt ? format(new Date(post.scheduledAt), 'yyyy-MM-dd') : '',
      post.scheduledAt ? format(new Date(post.scheduledAt), 'HH:mm') : '',
      post.platforms.join(';')
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    downloadFile(csvContent, `social-posts-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv')
  }

  const exportToiCal = (posts: Post[]) => {
    const events = posts
      .filter(post => post.scheduledAt)
      .map(post => {
        const startDate = new Date(post.scheduledAt!)
        const endDate = new Date(startDate.getTime() + 30 * 60000) // 30 minutes duration
        
        return [
          'BEGIN:VEVENT',
          `DTSTART:${formatICalDate(startDate)}`,
          `DTEND:${formatICalDate(endDate)}`,
          `SUMMARY:${post.title || 'Social Media Post'}`,
          `DESCRIPTION:${post.baseContent?.replace(/\n/g, '\\n') || ''}`,
          `CATEGORIES:${post.platforms.join(',')}`,
          `STATUS:${post.status}`,
          `UID:${post.id}@sociallyhub.com`,
          'END:VEVENT'
        ].join('\r\n')
      })

    const iCalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SociallyHub//Social Media Calendar//EN',
      'CALSCALE:GREGORIAN',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n')

    downloadFile(iCalContent, `social-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`, 'text/calendar')
  }

  const exportToJSON = (posts: Post[]) => {
    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange,
      totalPosts: posts.length,
      posts: posts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.baseContent,
        status: post.status,
        scheduledAt: post.scheduledAt,
        platforms: post.platforms
      }))
    }

    const jsonContent = JSON.stringify(exportData, null, 2)
    downloadFile(jsonContent, `social-posts-${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json')
  }

  const formatICalDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        
        if (file.name.endsWith('.csv')) {
          await importFromCSV(content)
        } else if (file.name.endsWith('.json')) {
          await importFromJSON(content)
        } else {
          throw new Error('Unsupported file format')
        }
        
        alert('Import completed successfully!')
        onClose()
        window.location.reload()
      } catch (error) {
        console.error('Import failed:', error)
        alert('Import failed. Please check the file format and try again.')
      } finally {
        setLoading(false)
      }
    }
    
    reader.readAsText(file)
  }

  const importFromCSV = async (csvContent: string) => {
    const lines = csvContent.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
    
    const posts = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim())
      
      const title = values[headers.indexOf('title')] || 'Imported Post'
      const content = values[headers.indexOf('content')] || ''
      const date = values[headers.indexOf('scheduled date')] || ''
      const time = values[headers.indexOf('scheduled time')] || '09:00'
      const platforms = (values[headers.indexOf('platforms')] || 'TWITTER').split(';').filter(p => p.trim())
      
      if (content && date) {
        const scheduledAt = new Date(`${date}T${time}`).toISOString()
        
        posts.push({
          title,
          content: {
            text: content,
            media: [],
            hashtags: [],
            mentions: []
          },
          platforms,
          status: 'SCHEDULED',
          scheduledAt,
          tags: ['imported']
        })
      }
    }

    // Bulk create posts
    await Promise.all(
      posts.map(post =>
        fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post)
        })
      )
    )
  }

  const importFromJSON = async (jsonContent: string) => {
    const data = JSON.parse(jsonContent)
    const posts = data.posts || []

    // Bulk create posts
    await Promise.all(
      posts.map((post: any) =>
        fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: post.title,
            content: {
              text: post.content,
              media: [],
              hashtags: [],
              mentions: []
            },
            platforms: post.platforms,
            status: 'SCHEDULED',
            scheduledAt: post.scheduledAt,
            tags: ['imported']
          })
        )
      )
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Calendar Export/Import
          </DialogTitle>
          <DialogDescription>
            Export your calendar data or import posts from external sources
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === 'export' ? 'default' : 'outline'}
              onClick={() => setMode('export')}
              className="h-20 flex-col gap-2"
            >
              <Download className="h-6 w-6" />
              Export Calendar
            </Button>
            <Button
              variant={mode === 'import' ? 'default' : 'outline'}
              onClick={() => setMode('import')}
              className="h-20 flex-col gap-2"
            >
              <Upload className="h-6 w-6" />
              Import Posts
            </Button>
          </div>

          {mode === 'export' ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Export Format</Label>
                    <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV (Excel compatible)</SelectItem>
                        <SelectItem value="ical">iCal (Calendar import)</SelectItem>
                        <SelectItem value="json">JSON (Full data)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Last Month</SelectItem>
                        <SelectItem value="quarter">Last 3 Months</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                        <SelectItem value="all">All Posts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={exportPosts}
                disabled={loading}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {loading ? 'Exporting...' : 'Export Calendar'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <Label htmlFor="import-file">Import File</Label>
                  <div className="mt-2">
                    <input
                      id="import-file"
                      type="file"
                      accept=".csv,.json"
                      onChange={importFromFile}
                      className="w-full p-2 border rounded-md"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Supported formats: CSV, JSON
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">CSV Format Expected:</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>• Title, Content, Status, Scheduled Date, Scheduled Time, Platforms</div>
                    <div>• Date format: YYYY-MM-DD</div>
                    <div>• Time format: HH:MM</div>
                    <div>• Platforms: semicolon-separated (TWITTER;FACEBOOK;INSTAGRAM)</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}