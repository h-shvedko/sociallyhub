"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { CalendarEvent } from "./calendar-event"

interface Post {
  id: string
  title: string
  baseContent?: any  // The actual content from API
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  scheduledAt: string | null
  platforms: string[]
}

interface DraggableCalendarEventProps {
  post: Post
  compact?: boolean
  onPostClick?: (post: Post) => void
}

export function DraggableCalendarEvent({ post, compact = false, onPostClick }: DraggableCalendarEventProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: post.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        ${isDragging ? 'opacity-50 z-50' : ''}
        cursor-grab active:cursor-grabbing
      `}
    >
      <CalendarEvent post={post} compact={compact} onPostClick={onPostClick} />
    </div>
  )
}