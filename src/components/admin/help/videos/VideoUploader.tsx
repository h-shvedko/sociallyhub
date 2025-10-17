'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Upload,
  X,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Play,
  Youtube,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoFile {
  file: File
  preview: string
  duration?: number
  size: number
  type: string
}

interface VideoUploaderProps {
  onUploadComplete?: (videoData: any) => void
  onUploadProgress?: (progress: number) => void
  allowMultiple?: boolean
  maxFileSize?: number // in MB
  acceptedFormats?: string[]
  className?: string
}

export default function VideoUploader({
  onUploadComplete,
  onUploadProgress,
  allowMultiple = false,
  maxFileSize = 100,
  acceptedFormats = ['mp4', 'webm', 'ogg', 'avi', 'mov'],
  className
}: VideoUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<VideoFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url' | 'youtube'>('file')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoMetadata, setVideoMetadata] = useState({
    title: '',
    description: '',
    category: '',
    tags: [] as string[],
    isPublic: false
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }

  const handleFiles = (files: File[]) => {
    setError(null)
    const validFiles: VideoFile[] = []

    files.forEach(file => {
      // Check file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (!fileExtension || !acceptedFormats.includes(fileExtension)) {
        setError(`Invalid file type: ${file.name}. Supported formats: ${acceptedFormats.join(', ')}`)
        return
      }

      // Check file size
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > maxFileSize) {
        setError(`File too large: ${file.name}. Maximum size: ${maxFileSize}MB`)
        return
      }

      // Create video preview
      const preview = URL.createObjectURL(file)

      validFiles.push({
        file,
        preview,
        size: file.size,
        type: file.type
      })
    })

    if (allowMultiple) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    } else {
      setSelectedFiles(validFiles.slice(0, 1))
    }

    // Extract metadata from first video
    if (validFiles.length > 0 && !videoMetadata.title) {
      const fileName = validFiles[0].file.name
      setVideoMetadata(prev => ({
        ...prev,
        title: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      }))
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const handleUpload = async () => {
    if (uploadMethod === 'file' && selectedFiles.length === 0) {
      setError('Please select at least one video file')
      return
    }

    if (uploadMethod === 'url' && !videoUrl) {
      setError('Please enter a video URL')
      return
    }

    if (!videoMetadata.title || !videoMetadata.category) {
      setError('Please fill in required fields: title and category')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress(0)

    try {
      if (uploadMethod === 'file') {
        await uploadFiles()
      } else if (uploadMethod === 'url') {
        await importFromUrl()
      } else if (uploadMethod === 'youtube') {
        await importFromYouTube()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const uploadFiles = async () => {
    for (let i = 0; i < selectedFiles.length; i++) {
      const videoFile = selectedFiles[i]
      const formData = new FormData()
      formData.append('file', videoFile.file)
      formData.append('type', 'video')

      // Upload file
      const uploadResponse = await fetch('/api/admin/help/videos/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('File upload failed')
      }

      const uploadData = await uploadResponse.json()

      // Create video record
      const videoData = {
        title: selectedFiles.length === 1 ? videoMetadata.title : `${videoMetadata.title} - Part ${i + 1}`,
        description: videoMetadata.description,
        category: videoMetadata.category,
        tags: videoMetadata.tags,
        isPublic: videoMetadata.isPublic,
        videoFile: {
          url: uploadData.url,
          fileName: uploadData.fileName,
          size: uploadData.size,
          mimeType: uploadData.mimeType
        },
        duration: uploadData.duration || 0,
        resolution: uploadData.resolution,
        fileSize: uploadData.size,
        mimeType: uploadData.mimeType
      }

      const createResponse = await fetch('/api/admin/help/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(videoData)
      })

      if (!createResponse.ok) {
        throw new Error('Failed to create video record')
      }

      const createdVideo = await createResponse.json()

      // Update progress
      const progress = ((i + 1) / selectedFiles.length) * 100
      setUploadProgress(progress)
      onUploadProgress?.(progress)

      if (i === selectedFiles.length - 1) {
        setSuccess(`Successfully uploaded ${selectedFiles.length} video(s)`)
        onUploadComplete?.(createdVideo)

        // Reset form
        setSelectedFiles([])
        setVideoMetadata({
          title: '',
          description: '',
          category: '',
          tags: [],
          isPublic: false
        })
      }
    }
  }

  const importFromUrl = async () => {
    const importData = {
      action: 'import',
      videoUrl,
      platform: 'EXTERNAL',
      ...videoMetadata
    }

    const response = await fetch('/api/admin/help/videos/integrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(importData)
    })

    if (!response.ok) {
      throw new Error('Failed to import video from URL')
    }

    const result = await response.json()
    setSuccess('Video imported successfully')
    onUploadComplete?.(result.video)

    // Reset form
    setVideoUrl('')
    setVideoMetadata({
      title: '',
      description: '',
      category: '',
      tags: [],
      isPublic: false
    })
  }

  const importFromYouTube = async () => {
    const importData = {
      action: 'import',
      videoUrl,
      platform: 'YOUTUBE',
      ...videoMetadata
    }

    const response = await fetch('/api/admin/help/videos/integrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(importData)
    })

    if (!response.ok) {
      throw new Error('Failed to import video from YouTube')
    }

    const result = await response.json()
    setSuccess('YouTube video imported successfully')
    onUploadComplete?.(result.video)

    // Reset form
    setVideoUrl('')
    setVideoMetadata({
      title: '',
      description: '',
      category: '',
      tags: [],
      isPublic: false
    })
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Method Selection */}
        <div className="flex gap-2">
          <Button
            variant={uploadMethod === 'file' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMethod('file')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
          <Button
            variant={uploadMethod === 'url' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMethod('url')}
          >
            <Globe className="h-4 w-4 mr-2" />
            Import URL
          </Button>
          <Button
            variant={uploadMethod === 'youtube' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUploadMethod('youtube')}
          >
            <Youtube className="h-4 w-4 mr-2" />
            YouTube
          </Button>
        </div>

        {/* File Upload */}
        {uploadMethod === 'file' && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
              'hover:border-gray-400'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileVideo className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">
              Drop your video files here, or{' '}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
            </h3>
            <p className="text-gray-600 mb-4">
              Supports {acceptedFormats.join(', ')} • Max {maxFileSize}MB per file
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFormats.map(format => `.${format}`).join(',')}
              multiple={allowMultiple}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        )}

        {/* URL Import */}
        {(uploadMethod === 'url' || uploadMethod === 'youtube') && (
          <div className="space-y-2">
            <Label htmlFor="videoUrl">
              {uploadMethod === 'youtube' ? 'YouTube URL' : 'Video URL'}
            </Label>
            <Input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={
                uploadMethod === 'youtube'
                  ? 'https://www.youtube.com/watch?v=...'
                  : 'https://example.com/video.mp4'
              }
            />
          </div>
        )}

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Files</Label>
            {selectedFiles.map((videoFile, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded">
                <video
                  src={videoFile.preview}
                  className="w-16 h-16 object-cover rounded"
                  muted
                />
                <div className="flex-1">
                  <div className="font-medium">{videoFile.file.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(videoFile.size)} • {videoFile.type}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Video Metadata */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={videoMetadata.title}
              onChange={(e) => setVideoMetadata(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter video title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={videoMetadata.category}
              onValueChange={(value) => setVideoMetadata(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TUTORIAL">Tutorial</SelectItem>
                <SelectItem value="GUIDE">Guide</SelectItem>
                <SelectItem value="DEMO">Demo</SelectItem>
                <SelectItem value="WEBINAR">Webinar</SelectItem>
                <SelectItem value="TRAINING">Training</SelectItem>
                <SelectItem value="OVERVIEW">Overview</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={videoMetadata.description}
            onChange={(e) => setVideoMetadata(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter video description"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            placeholder="Enter tags separated by commas"
            onChange={(e) => {
              const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
              setVideoMetadata(prev => ({ ...prev, tags }))
            }}
          />
          {videoMetadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {videoMetadata.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span>{success}</span>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={uploading || (uploadMethod === 'file' && selectedFiles.length === 0) || (uploadMethod !== 'file' && !videoUrl)}
          className="w-full"
        >
          {uploading ? (
            'Uploading...'
          ) : uploadMethod === 'file' ? (
            'Upload Video'
          ) : (
            'Import Video'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}