'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  Search, 
  Filter, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Download, 
  Trash2, 
  Eye,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Asset {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  uploadedBy: {
    name: string
    email: string
  }
  createdAt: string
  metadata?: {
    width?: number
    height?: number
    duration?: number
  }
  tags: string[]
}

interface AssetsManagerProps {
  workspaceId: string
}

export function AssetsManager({ workspaceId }: AssetsManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    fetchAssets()
  }, [workspaceId])

  useEffect(() => {
    filterAndSortAssets()
  }, [assets, searchQuery, selectedFilter, sortBy, sortOrder])

  const fetchAssets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/media?workspaceId=${workspaceId}`)
      
      if (response.ok) {
        const data = await response.json()
        setAssets(data.assets || [])
      } else {
        console.error('Failed to fetch assets')
        setAssets([])
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
      setAssets([])
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortAssets = () => {
    let filtered = assets

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(asset =>
        asset.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Apply type filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(asset => {
        if (selectedFilter === 'images') return asset.mimeType.startsWith('image/')
        if (selectedFilter === 'videos') return asset.mimeType.startsWith('video/')
        if (selectedFilter === 'documents') return asset.mimeType.startsWith('application/')
        return true
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      if (sortBy === 'name') {
        comparison = a.originalName.localeCompare(b.originalName)
      } else if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortBy === 'size') {
        comparison = a.size - b.size
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredAssets(filtered)
  }

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true)
    
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('workspaceId', workspaceId)
        
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const newAsset = await response.json()
          setAssets(prev => [newAsset, ...prev])
        } else {
          const error = await response.json()
          console.error('Upload failed:', error.error)
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    )
  }

  const deleteSelectedAssets = async () => {
    if (selectedAssets.length === 0) return

    try {
      const response = await fetch('/api/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assetIds: selectedAssets,
          workspaceId 
        })
      })

      if (response.ok) {
        setAssets(prev => prev.filter(asset => !selectedAssets.includes(asset.id)))
        setSelectedAssets([])
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />
    if (mimeType.startsWith('video/')) return <Video className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            Manage your media files and assets for social media content
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="file"
            multiple
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="hidden"
            id="file-upload"
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
          <Button 
            disabled={isUploading} 
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Files</option>
                <option value="images">Images</option>
                <option value="videos">Videos</option>
                <option value="documents">Documents</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="size">Sort by Size</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
              
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {selectedAssets.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-md flex items-center justify-between">
              <span className="text-sm">
                {selectedAssets.length} file{selectedAssets.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button size="sm" variant="destructive" onClick={deleteSelectedAssets}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets Display */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading assets...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <Card 
              key={asset.id} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedAssets.includes(asset.id) && "ring-2 ring-primary"
              )}
              onClick={() => toggleAssetSelection(asset.id)}
            >
              <CardContent className="p-4">
                {asset.mimeType.startsWith('image/') ? (
                  <div className="aspect-square bg-muted rounded-md mb-3 overflow-hidden">
                    <img
                      src={asset.thumbnailUrl || asset.url}
                      alt={asset.originalName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-muted rounded-md mb-3 flex items-center justify-center">
                    {getFileIcon(asset.mimeType)}
                  </div>
                )}
                
                <div className="space-y-2">
                  <h3 className="font-medium text-sm truncate" title={asset.originalName}>
                    {asset.originalName}
                  </h3>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(asset.size)}</span>
                    <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                  </div>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {asset.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{asset.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredAssets.map((asset) => (
                <div 
                  key={asset.id}
                  className={cn(
                    "flex items-center p-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50",
                    selectedAssets.includes(asset.id) && "bg-primary/10"
                  )}
                  onClick={() => toggleAssetSelection(asset.id)}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileIcon(asset.mimeType)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {asset.originalName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Uploaded by {asset.uploadedBy.name} on {new Date(asset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>{formatFileSize(asset.size)}</span>
                    {asset.tags.length > 0 && (
                      <div className="flex space-x-1">
                        {asset.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAssets.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No assets found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Upload your first asset to get started'
            }
          </p>
          {!searchQuery && selectedFilter === 'all' && (
            <Button onClick={() => document.getElementById('file-upload')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          )}
        </div>
      )}
    </div>
  )
}