'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload,
  X,
  Edit,
  Move,
  Eye,
  FileImage,
  FileVideo,
  Loader2,
  Plus,
  GripVertical,
  Copy,
  ExternalLink
} from 'lucide-react'

interface MediaItem {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  filePath: string
  alt?: string
  caption?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface MediaManagerProps {
  articleId?: string
  onMediaSelect?: (media: MediaItem) => void
  showSelection?: boolean
  allowUpload?: boolean
  className?: string
}

export default function MediaManager({
  articleId,
  onMediaSelect,
  showSelection = false,
  allowUpload = true,
  className = ''
}: MediaManagerProps) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null)
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null)
  const [draggedItem, setDraggedItem] = useState<MediaItem | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadForm, setUploadForm] = useState({
    alt: '',
    caption: ''
  })

  useEffect(() => {
    if (articleId) {
      fetchMedia()
    } else {
      setIsLoading(false)
    }
  }, [articleId])

  const fetchMedia = async () => {
    if (!articleId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/help/articles/${articleId}/media`)
      if (!response.ok) {
        throw new Error('Failed to fetch media')
      }

      const data = await response.json()
      setMedia(data.media || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch media')
      console.error('Error fetching media:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setShowUploadForm(true)
    }
  }

  const handleUpload = async () => {
    if (!articleId || !fileInputRef.current?.files?.[0]) return

    try {
      setIsUploading(true)
      setError(null)

      const file = fileInputRef.current.files[0]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', uploadForm.alt)
      formData.append('caption', uploadForm.caption)

      const response = await fetch(`/api/admin/help/articles/${articleId}/media`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload media')
      }

      const newMedia = await response.json()
      setMedia(prev => [...prev, newMedia])

      // Reset form
      setUploadForm({ alt: '', caption: '' })
      setShowUploadForm(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload media')
      console.error('Error uploading media:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpdateMedia = async (mediaId: string, updates: Partial<MediaItem>) => {
    if (!articleId) return

    try {
      const response = await fetch(`/api/admin/help/articles/${articleId}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update media')
      }

      const updatedMedia = await response.json()
      setMedia(prev => prev.map(item => item.id === mediaId ? updatedMedia : item))
      setEditingMedia(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update media')
      console.error('Error updating media:', err)
    }
  }

  const handleDeleteMedia = async (mediaId: string) => {
    if (!articleId || !confirm('Are you sure you want to delete this media?')) return

    try {
      const response = await fetch(`/api/admin/help/articles/${articleId}/media/${mediaId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete media')
      }

      setMedia(prev => prev.filter(item => item.id !== mediaId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete media')
      console.error('Error deleting media:', err)
    }
  }

  const handleReorderMedia = async (reorderedMedia: MediaItem[]) => {
    if (!articleId) return

    const mediaOrders = reorderedMedia.map((item, index) => ({
      id: item.id,
      sortOrder: index
    }))

    try {
      const response = await fetch(`/api/admin/help/articles/${articleId}/media/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mediaOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder media')
      }

      setMedia(reorderedMedia)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder media')
      console.error('Error reordering media:', err)
    }
  }

  const handleDragStart = (e: React.DragEvent, item: MediaItem) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetItem: MediaItem) => {
    e.preventDefault()

    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null)
      return
    }

    const newMedia = [...media]
    const draggedIndex = newMedia.findIndex(item => item.id === draggedItem.id)
    const targetIndex = newMedia.findIndex(item => item.id === targetItem.id)

    // Remove dragged item and insert at target position
    const [removed] = newMedia.splice(draggedIndex, 1)
    newMedia.splice(targetIndex, 0, removed)

    // Update sort orders
    const reorderedMedia = newMedia.map((item, index) => ({
      ...item,
      sortOrder: index
    }))

    setMedia(reorderedMedia)
    handleReorderMedia(reorderedMedia)
    setDraggedItem(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getMediaIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-blue-500" />
    } else if (mimeType.startsWith('video/')) {
      return <FileVideo className="h-5 w-5 text-purple-500" />
    }
    return <FileImage className="h-5 w-5 text-gray-500" />
  }

  const isImage = (mimeType: string) => mimeType.startsWith('image/')
  const isVideo = (mimeType: string) => mimeType.startsWith('video/')

  if (!articleId) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <FileImage className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p>Media management is available after saving the article</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Media Library</h3>
          {allowUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alt Text
              </label>
              <input
                type="text"
                value={uploadForm.alt}
                onChange={(e) => setUploadForm(prev => ({ ...prev, alt: e.target.value }))}
                placeholder="Describe the image for accessibility..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caption
              </label>
              <input
                type="text"
                value={uploadForm.caption}
                onChange={(e) => setUploadForm(prev => ({ ...prev, caption: e.target.value }))}
                placeholder="Optional caption..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowUploadForm(false)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-8">
            <FileImage className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-500">No media uploaded yet</p>
            {allowUpload && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Upload your first media file
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {media.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item)}
                className="relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-move"
              >
                {/* Drag Handle */}
                <div className="absolute top-2 left-2 z-10">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>

                {/* Media Preview */}
                <div className="aspect-video bg-gray-100 relative">
                  {isImage(item.mimeType) ? (
                    <img
                      src={item.filePath}
                      alt={item.alt || item.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo(item.mimeType) ? (
                    <video
                      src={item.filePath}
                      className="w-full h-full object-cover"
                      controls={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getMediaIcon(item.mimeType)}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <button
                      onClick={() => setPreviewMedia(item)}
                      className="p-1 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setEditingMedia(item)}
                      className="p-1 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteMedia(item.id)}
                      className="p-1 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Select Button */}
                  {showSelection && onMediaSelect && (
                    <div className="absolute bottom-2 right-2">
                      <button
                        onClick={() => onMediaSelect(item)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Select
                      </button>
                    </div>
                  )}
                </div>

                {/* Media Info */}
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.originalName}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(item.fileSize)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.filePath)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="Copy URL"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  {item.caption && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {item.caption}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Edit Modal */}
      {editingMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Media</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Text
                </label>
                <input
                  type="text"
                  value={editingMedia.alt || ''}
                  onChange={(e) => setEditingMedia(prev => prev ? { ...prev, alt: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption
                </label>
                <input
                  type="text"
                  value={editingMedia.caption || ''}
                  onChange={(e) => setEditingMedia(prev => prev ? { ...prev, caption: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setEditingMedia(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateMedia(editingMedia.id, {
                    alt: editingMedia.alt,
                    caption: editingMedia.caption
                  })}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
            >
              <X className="h-4 w-4" />
            </button>
            {isImage(previewMedia.mimeType) ? (
              <img
                src={previewMedia.filePath}
                alt={previewMedia.alt || previewMedia.originalName}
                className="max-w-full max-h-[90vh] object-contain"
              />
            ) : isVideo(previewMedia.mimeType) ? (
              <video
                src={previewMedia.filePath}
                controls
                className="max-w-full max-h-[90vh] object-contain"
              />
            ) : (
              <div className="p-8 text-center">
                {getMediaIcon(previewMedia.mimeType)}
                <p className="mt-2 text-gray-600">{previewMedia.originalName}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}