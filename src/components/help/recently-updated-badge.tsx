import { Badge } from '@/components/ui/badge'
import { Clock, Sparkles } from 'lucide-react'
import { isRecentlyUpdated, getUpdateTimeText } from '@/lib/utils/reading-time'

interface RecentlyUpdatedBadgeProps {
  updatedAt: Date | string
  createdAt?: Date | string
  className?: string
  variant?: 'default' | 'secondary' | 'outline'
  showText?: boolean
  daysThreshold?: number
}

export function RecentlyUpdatedBadge({
  updatedAt,
  createdAt,
  className = '',
  variant = 'default',
  showText = true,
  daysThreshold = 7
}: RecentlyUpdatedBadgeProps) {
  const isRecent = isRecentlyUpdated(updatedAt, daysThreshold)

  // Don't show if not recently updated
  if (!isRecent) {
    return null
  }

  // Check if this is a new article (created within threshold) vs updated
  const isNewArticle = createdAt && isRecentlyUpdated(createdAt, daysThreshold)
  const updateText = getUpdateTimeText(updatedAt)

  if (isNewArticle) {
    return (
      <Badge
        variant={variant}
        className={`bg-green-100 text-green-800 border-green-200 ${className}`}
      >
        <Sparkles className="h-3 w-3 mr-1" />
        {showText && 'New'}
      </Badge>
    )
  }

  return (
    <Badge
      variant={variant}
      className={`bg-blue-100 text-blue-800 border-blue-200 ${className}`}
      title={updateText}
    >
      <Clock className="h-3 w-3 mr-1" />
      {showText && 'Updated'}
    </Badge>
  )
}

interface ReadingTimeBadgeProps {
  readingTime?: number
  className?: string
}

export function ReadingTimeBadge({ readingTime, className = '' }: ReadingTimeBadgeProps) {
  if (!readingTime) {
    return null
  }

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      <Clock className="h-3 w-3 mr-1" />
      {readingTime === 1 ? '1 min read' : `${readingTime} min read`}
    </Badge>
  )
}

interface ArticleMetaBadgesProps {
  article: {
    readingTime?: number
    updatedAt: Date | string
    createdAt?: Date | string
    views?: number
    helpfulVotes?: number
  }
  className?: string
  showViews?: boolean
  showHelpful?: boolean
}

export function ArticleMetaBadges({
  article,
  className = '',
  showViews = true,
  showHelpful = true
}: ArticleMetaBadgesProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <RecentlyUpdatedBadge
        updatedAt={article.updatedAt}
        createdAt={article.createdAt}
      />

      <ReadingTimeBadge readingTime={article.readingTime} />

      {showViews && article.views !== undefined && (
        <Badge variant="outline" className="text-xs">
          {article.views.toLocaleString()} views
        </Badge>
      )}

      {showHelpful && article.helpfulVotes !== undefined && (
        <Badge variant="outline" className="text-xs">
          {article.helpfulVotes} helpful
        </Badge>
      )}
    </div>
  )
}