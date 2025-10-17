'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Edit,
  Trash2,
  MoreHorizontal,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  ThumbsUp,
  ThumbsDown,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Copy,
  BarChart3
} from 'lucide-react'

interface FAQ {
  id: string
  question: string
  answer: string
  category: {
    id: string
    name: string
    slug: string
  }
  tags: string[]
  sortOrder: number
  isActive: boolean
  isPinned: boolean
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  helpfulnessRate?: string
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface FAQListProps {
  faqs: FAQ[]
  categories: Category[]
  loading: boolean
  error: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onEdit: (faq: FAQ) => void
  onDelete: (faqId: string) => void
  onBulkAction: (action: string, faqIds: string[], data?: any) => void
  onReorder: (updates: Array<{ id: string; sortOrder: number }>) => void
}

function SortableFAQRow({ faq, isSelected, onSelect, onEdit, onDelete }: {
  faq: FAQ
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onEdit: (faq: FAQ) => void
  onDelete: (faqId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: faq.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const helpfulnessRate = faq.helpfulVotes + faq.notHelpfulVotes > 0
    ? ((faq.helpfulVotes / (faq.helpfulVotes + faq.notHelpfulVotes)) * 100).toFixed(1)
    : '0'

  const handleCopy = () => {
    navigator.clipboard.writeText(`${faq.question}\n\n${faq.answer}`)
    alert('FAQ content copied to clipboard!')
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 ${isDragging ? 'bg-blue-50' : ''} ${
        isSelected ? 'bg-blue-50' : ''
      }`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="mr-3"
          />
          <button
            {...attributes}
            {...listeners}
            className="p-1 hover:bg-gray-200 rounded"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-start space-x-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {faq.question}
              </p>
              {faq.isPinned && (
                <Pin className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {faq.answer.replace(/<[^>]*>/g, '').substring(0, 150)}...
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {faq.category.name}
              </Badge>
              {faq.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {faq.tags.length > 2 && (
                <span className="text-xs text-gray-500">
                  +{faq.tags.length - 2} more
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center">
          {faq.isActive ? (
            <Eye className="h-4 w-4 text-green-500 mr-2" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-400 mr-2" />
          )}
          {faq.isActive ? 'Active' : 'Inactive'}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">{faq.views}</div>
          <div className="text-xs text-gray-500">views</div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center justify-center space-x-2">
          <div className="flex items-center text-green-600">
            <ThumbsUp className="h-3 w-3 mr-1" />
            <span className="text-xs">{faq.helpfulVotes}</span>
          </div>
          <div className="flex items-center text-red-600">
            <ThumbsDown className="h-3 w-3 mr-1" />
            <span className="text-xs">{faq.notHelpfulVotes}</span>
          </div>
        </div>
        <div className="text-center">
          <span className={`text-xs font-medium ${
            parseFloat(helpfulnessRate) >= 70 ? 'text-green-600' :
            parseFloat(helpfulnessRate) >= 40 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {helpfulnessRate}%
          </span>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(faq.updatedAt).toLocaleDateString()}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(faq)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Content
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              {faq.isPinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem>
              {faq.isActive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(faq.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

export default function FAQList({
  faqs,
  categories,
  loading,
  error,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onBulkAction,
  onReorder
}: FAQListProps) {
  const [selectedFaqs, setSelectedFaqs] = useState<string[]>([])
  const [localFaqs, setLocalFaqs] = useState(faqs)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Update local FAQs when props change
  useState(() => {
    setLocalFaqs(faqs)
  }, [faqs])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFaqs(localFaqs.map(faq => faq.id))
    } else {
      setSelectedFaqs([])
    }
  }

  const handleSelectFAQ = (faqId: string, checked: boolean) => {
    if (checked) {
      setSelectedFaqs([...selectedFaqs, faqId])
    } else {
      setSelectedFaqs(selectedFaqs.filter(id => id !== faqId))
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = localFaqs.findIndex(faq => faq.id === active.id)
      const newIndex = localFaqs.findIndex(faq => faq.id === over.id)

      const newFaqs = arrayMove(localFaqs, oldIndex, newIndex)
      setLocalFaqs(newFaqs)

      // Prepare updates with new sort orders
      const updates = newFaqs.map((faq, index) => ({
        id: faq.id,
        sortOrder: index + 1
      }))

      onReorder(updates)
    }
  }

  const handleBulkActivate = () => {
    onBulkAction('bulk_update', selectedFaqs, { isActive: true })
    setSelectedFaqs([])
  }

  const handleBulkDeactivate = () => {
    onBulkAction('bulk_update', selectedFaqs, { isActive: false })
    setSelectedFaqs([])
  }

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedFaqs.length} FAQ(s)?`)) {
      onBulkAction('bulk_delete', selectedFaqs)
      setSelectedFaqs([])
    }
  }

  const handleBulkCategoryChange = (categoryId: string) => {
    onBulkAction('bulk_update', selectedFaqs, { categoryId })
    setSelectedFaqs([])
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedFaqs.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-700">
            {selectedFaqs.length} FAQ{selectedFaqs.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkActivate}
            >
              <Eye className="h-4 w-4 mr-2" />
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkDeactivate}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Deactivate
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Move to Category
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category.id}
                    onClick={() => handleBulkCategoryChange(category.id)}
                  >
                    {category.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* FAQ Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Checkbox
                  checked={selectedFaqs.length === localFaqs.length && localFaqs.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Question & Answer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Views
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Helpfulness
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={localFaqs.map(faq => faq.id)}
                strategy={verticalListSortingStrategy}
              >
                {localFaqs.map((faq) => (
                  <SortableFAQRow
                    key={faq.id}
                    faq={faq}
                    isSelected={selectedFaqs.includes(faq.id)}
                    onSelect={(checked) => handleSelectFAQ(faq.id, checked)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {localFaqs.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No FAQs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first FAQ.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <Button
              variant="outline"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="rounded-r-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      className="rounded-none border-l-0"
                    >
                      {page}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="rounded-l-none border-l-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}