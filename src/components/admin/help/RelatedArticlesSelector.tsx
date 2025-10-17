'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, X } from 'lucide-react'

interface Article {
  id: string
  title: string
  slug: string
  category: {
    id: string
    name: string
  }
  tags: string[]
  status: string
}

interface RelatedArticlesSelectorProps {
  currentArticleId?: string
  selectedArticles: string[]
  onSelect: (articles: string[]) => void
  isOpen: boolean
  onClose: () => void
}

export default function RelatedArticlesSelector({
  currentArticleId,
  selectedArticles,
  onSelect,
  isOpen,
  onClose,
}: RelatedArticlesSelectorProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedArticles)

  useEffect(() => {
    setSelectedIds(selectedArticles)
  }, [selectedArticles])

  useEffect(() => {
    if (isOpen) {
      fetchArticles()
    }
  }, [isOpen])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/help/articles?status=published&limit=100')
      if (!response.ok) throw new Error('Failed to fetch articles')
      const data = await response.json()

      // Filter out current article if editing
      const filteredArticles = currentArticleId
        ? data.articles.filter((a: Article) => a.id !== currentArticleId)
        : data.articles

      setArticles(filteredArticles)
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleArticle = (articleId: string) => {
    setSelectedIds((prev) =>
      prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId]
    )
  }

  const handleSave = () => {
    onSelect(selectedIds)
    onClose()
  }

  const handleClear = () => {
    setSelectedIds([])
  }

  const filteredArticles = articles.filter((article) =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const selectedArticleDetails = articles.filter((a) => selectedIds.includes(a.id))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Related Articles</DialogTitle>
          <DialogDescription>
            Choose articles that are related to this content. Selected articles will be displayed as suggestions to readers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles by title or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Selected Articles Summary */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedIds.length} article{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                Clear all
              </Button>
            </div>
          )}

          {/* Articles List */}
          <ScrollArea className="h-[350px] border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Loading articles...</div>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">
                  {searchQuery ? 'No articles found' : 'No published articles available'}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={article.id}
                      checked={selectedIds.includes(article.id)}
                      onCheckedChange={() => toggleArticle(article.id)}
                    />
                    <label
                      htmlFor={article.id}
                      className="flex-1 cursor-pointer space-y-1"
                    >
                      <p className="font-medium text-sm">{article.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {article.category.name}
                        </Badge>
                        {article.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {article.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{article.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Articles Preview */}
          {selectedArticleDetails.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Selected articles:</p>
              <div className="flex flex-wrap gap-2">
                {selectedArticleDetails.map((article) => (
                  <Badge key={article.id} variant="secondary" className="pr-1">
                    {article.title}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => toggleArticle(article.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}