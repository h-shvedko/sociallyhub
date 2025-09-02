"use client"

import { useState, useEffect, useCallback } from "react"
import { format, 
         startOfMonth, 
         endOfMonth, 
         startOfWeek, 
         endOfWeek, 
         eachDayOfInterval,
         isSameMonth,
         isSameDay,
         isToday,
         startOfDay,
         endOfDay,
         addDays } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CalendarEvent } from "./calendar-event"
import { DraggableCalendarEvent } from "./draggable-calendar-event"
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors 
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"

type CalendarView = 'month' | 'week' | 'day'

interface Post {
  id: string
  title: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  scheduledAt: string | null
  platforms: string[]
}

interface CalendarGridProps {
  view: CalendarView
  currentDate: Date
  onDateSelect: (date: Date) => void
}

export function CalendarGrid({ view, currentDate, onDateSelect }: CalendarGridProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Fetch posts for the current period
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/posts')
        if (response.ok) {
          const data = await response.json()
          setPosts(data.posts || [])
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [currentDate, view])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    // Parse the drop target
    const targetDateStr = over.id as string
    const postId = active.id as string
    
    try {
      // Update the post's scheduled date
      const targetDate = new Date(targetDateStr)
      
      // Keep the original time if it exists, or set to 9 AM
      const originalPost = posts.find(p => p.id === postId)
      if (originalPost?.scheduledAt) {
        const originalTime = new Date(originalPost.scheduledAt)
        targetDate.setHours(originalTime.getHours(), originalTime.getMinutes())
      } else {
        targetDate.setHours(9, 0, 0, 0) // Default to 9 AM
      }

      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduledAt: targetDate.toISOString(),
          status: 'SCHEDULED'
        }),
      })

      if (response.ok) {
        // Update local state
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, scheduledAt: targetDate.toISOString(), status: 'SCHEDULED' as const }
            : post
        ))
      } else {
        console.error('Failed to update post schedule')
      }
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }, [posts])

  const activeDragPost = posts.find(post => post.id === activeId)

  // Generate calendar dates based on view
  const generateCalendarDates = () => {
    switch (view) {
      case 'month':
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
      
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
        return eachDayOfInterval({ start: weekStart, end: weekEnd })
      
      case 'day':
        return [currentDate]
      
      default:
        return []
    }
  }

  // Get posts for a specific date
  const getPostsForDate = (date: Date) => {
    return posts.filter(post => {
      if (!post.scheduledAt) return false
      const postDate = new Date(post.scheduledAt)
      return isSameDay(postDate, date)
    })
  }

  const calendarDates = generateCalendarDates()
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (view === 'month') {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Card className="shadow-md">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 gap-0 border-b">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="p-4 text-center text-sm font-semibold text-muted-foreground bg-muted/30 border-r last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0">
              {calendarDates.map((date, index) => {
                const dayPosts = getPostsForDate(date)
                const isCurrentMonth = isSameMonth(date, currentDate)
                const isSelectedDay = isSameDay(date, currentDate)
                const isTodayDate = isToday(date)
                
                return (
                  <DroppableCalendarDay
                    key={date.toISOString()}
                    date={date}
                    posts={dayPosts}
                    isCurrentMonth={isCurrentMonth}
                    isSelectedDay={isSelectedDay}
                    isTodayDate={isTodayDate}
                    onDateSelect={onDateSelect}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
        <DragOverlay>
          {activeDragPost ? (
            <div className="opacity-80 transform rotate-2 shadow-lg">
              <CalendarEvent post={activeDragPost} compact />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    )
  }

  if (view === 'week') {
    return (
      <Card className="shadow-md">
        <CardContent className="p-0">
          <div className="grid grid-cols-8 gap-0 border-b">
            <div className="p-4 text-center text-sm font-semibold text-muted-foreground bg-muted/30 border-r">
              Time
            </div>
            {calendarDates.map((date) => (
              <div
                key={date.toISOString()}
                className={cn(
                  "p-4 text-center text-sm font-semibold border-r last:border-r-0 cursor-pointer hover:bg-muted/20 transition-colors",
                  isToday(date) ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground"
                )}
                onClick={() => onDateSelect(date)}
              >
                <div className="font-medium">{format(date, 'EEE')}</div>
                <div className={cn(
                  "text-lg",
                  isToday(date) && "font-bold"
                )}>
                  {format(date, 'd')}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0">
            {/* Time column */}
            <div className="border-r">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="h-16 px-2 py-1 border-b text-xs text-muted-foreground">
                  {i.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {/* Day columns */}
            {calendarDates.map((date) => {
              const dayPosts = getPostsForDate(date)
              return (
                <div key={date.toISOString()} className="border-r last:border-r-0">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="h-16 p-1 border-b hover:bg-muted/20 cursor-pointer transition-colors">
                      {/* Show posts scheduled for this hour */}
                      {dayPosts
                        .filter(post => post.scheduledAt && new Date(post.scheduledAt).getHours() === i)
                        .map(post => (
                          <CalendarEvent key={post.id} post={post} compact />
                        ))}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (view === 'day') {
    const dayPosts = getPostsForDate(currentDate)
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time Schedule */}
        <div className="lg:col-span-2">
          <Card className="shadow-md">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-0">
                {/* Time column */}
                <div className="border-r">
                  <div className="p-4 text-center text-sm font-semibold text-muted-foreground bg-muted/30 border-b">
                    Time
                  </div>
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="h-20 px-4 py-2 border-b text-sm text-muted-foreground flex items-start">
                      {i.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
                {/* Events column */}
                <div>
                  <div className="p-4 text-center text-sm font-semibold text-muted-foreground bg-muted/30 border-b">
                    {format(currentDate, 'EEEE, MMM dd')}
                  </div>
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="h-20 p-2 border-b hover:bg-muted/20 cursor-pointer transition-colors">
                      {dayPosts
                        .filter(post => post.scheduledAt && new Date(post.scheduledAt).getHours() === i)
                        .map(post => (
                          <CalendarEvent key={post.id} post={post} />
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Day Summary */}
        <div className="space-y-4">
          <Card className="shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Day Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Posts</span>
                  <span className="font-medium">{dayPosts.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Scheduled</span>
                  <span className="font-medium">
                    {dayPosts.filter(p => p.status === 'SCHEDULED').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Published</span>
                  <span className="font-medium">
                    {dayPosts.filter(p => p.status === 'PUBLISHED').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* All Day Posts */}
          {dayPosts.length > 0 && (
            <Card className="shadow-md">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">All Posts</h3>
                <div className="space-y-2">
                  {dayPosts.map(post => (
                    <CalendarEvent key={post.id} post={post} detailed />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  return null
}

// Droppable Calendar Day Component
import { useDroppable } from "@dnd-kit/core"

interface DroppableCalendarDayProps {
  date: Date
  posts: Post[]
  isCurrentMonth: boolean
  isSelectedDay: boolean
  isTodayDate: boolean
  onDateSelect: (date: Date) => void
}

function DroppableCalendarDay({
  date,
  posts,
  isCurrentMonth,
  isSelectedDay,
  isTodayDate,
  onDateSelect
}: DroppableCalendarDayProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: date.toISOString(),
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] p-2 border-r border-b last:border-r-0 cursor-pointer transition-all duration-200",
        "hover:bg-muted/20",
        !isCurrentMonth && "bg-muted/10 text-muted-foreground",
        isSelectedDay && "ring-2 ring-primary/50",
        isTodayDate && "bg-primary/5",
        isOver && "bg-primary/10 ring-2 ring-primary/30"
      )}
      onClick={() => onDateSelect(date)}
    >
      <div className={cn(
        "text-sm font-medium mb-2",
        isTodayDate && "text-primary font-semibold"
      )}>
        {format(date, 'd')}
      </div>
      <div className="space-y-1">
        {posts.slice(0, 3).map((post) => (
          <DraggableCalendarEvent key={post.id} post={post} compact />
        ))}
        {posts.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{posts.length - 3} more
          </div>
        )}
      </div>
    </div>
  )
}