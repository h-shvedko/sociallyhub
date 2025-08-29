"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Settings,
  Plus,
  Trash2,
  Edit,
  Save,
  RotateCcw,
  Layout,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Eye,
  MessageSquare,
  Share2,
  Heart,
  Calendar,
  Clock,
  RefreshCw,
  Globe,
  Target,
  Zap,
  PieChart,
  LineChart,
  AreaChart,
  Grid3x3,
  Maximize,
  Minimize,
  Copy,
  Download,
  Upload,
  Palette
} from "lucide-react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"

type WidgetType = 'metric' | 'chart' | 'table' | 'progress' | 'activity_feed' | 'calendar' | 'gauge'
type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'donut'
type WidgetSize = 'small' | 'medium' | 'large' | 'full'

interface Widget {
  id: string
  type: WidgetType
  title: string
  metric?: string
  chartType?: ChartType
  size: WidgetSize
  color: string
  position: { x: number; y: number }
  config: {
    showTrend?: boolean
    showPercentage?: boolean
    timeRange?: string
    platforms?: string[]
    [key: string]: any
  }
}

interface CustomDashboardProps {
  className?: string
}

const WIDGET_TYPES = [
  {
    type: 'metric' as WidgetType,
    name: 'Metric Card',
    description: 'Display key metrics with trends',
    icon: <BarChart3 className="h-4 w-4" />,
    sizes: ['small', 'medium']
  },
  {
    type: 'chart' as WidgetType,
    name: 'Chart Widget',
    description: 'Various chart types for data visualization',
    icon: <LineChart className="h-4 w-4" />,
    sizes: ['medium', 'large', 'full']
  },
  {
    type: 'table' as WidgetType,
    name: 'Data Table',
    description: 'Tabular data with sorting and filtering',
    icon: <Grid3x3 className="h-4 w-4" />,
    sizes: ['medium', 'large', 'full']
  },
  {
    type: 'progress' as WidgetType,
    name: 'Progress Indicator',
    description: 'Goal progress and completion tracking',
    icon: <Target className="h-4 w-4" />,
    sizes: ['small', 'medium']
  },
  {
    type: 'activity_feed' as WidgetType,
    name: 'Activity Feed',
    description: 'Recent activities and updates',
    icon: <Activity className="h-4 w-4" />,
    sizes: ['medium', 'large']
  },
  {
    type: 'calendar' as WidgetType,
    name: 'Calendar View',
    description: 'Schedule and upcoming posts',
    icon: <Calendar className="h-4 w-4" />,
    sizes: ['medium', 'large', 'full']
  },
  {
    type: 'gauge' as WidgetType,
    name: 'Gauge Chart',
    description: 'Circular progress and performance indicators',
    icon: <PieChart className="h-4 w-4" />,
    sizes: ['small', 'medium']
  }
]

const METRICS_OPTIONS = [
  { value: 'posts_published', label: 'Posts Published', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'engagement_rate', label: 'Engagement Rate', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'total_reach', label: 'Total Reach', icon: <Users className="h-4 w-4" /> },
  { value: 'page_views', label: 'Page Views', icon: <Eye className="h-4 w-4" /> },
  { value: 'total_comments', label: 'Comments', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'total_shares', label: 'Shares', icon: <Share2 className="h-4 w-4" /> },
  { value: 'total_likes', label: 'Likes', icon: <Heart className="h-4 w-4" /> },
  { value: 'follower_growth', label: 'Follower Growth', icon: <Activity className="h-4 w-4" /> }
]

const CHART_TYPES = [
  { value: 'line', label: 'Line Chart', icon: <LineChart className="h-4 w-4" /> },
  { value: 'bar', label: 'Bar Chart', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'area', label: 'Area Chart', icon: <AreaChart className="h-4 w-4" /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChart className="h-4 w-4" /> }
]

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' }
]

function SortableWidget({ widget, onEdit, onDelete }: { widget: Widget; onEdit: (widget: Widget) => void; onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getSizeClasses = (size: WidgetSize) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1'
      case 'medium': return 'col-span-2 row-span-1'
      case 'large': return 'col-span-2 row-span-2'
      case 'full': return 'col-span-4 row-span-2'
      default: return 'col-span-1 row-span-1'
    }
  }

  const getColorClasses = (color: string) => {
    const baseClass = 'border-l-4'
    switch (color) {
      case 'blue': return `${baseClass} border-blue-500`
      case 'green': return `${baseClass} border-green-500`
      case 'purple': return `${baseClass} border-purple-500`
      case 'orange': return `${baseClass} border-orange-500`
      case 'red': return `${baseClass} border-red-500`
      case 'pink': return `${baseClass} border-pink-500`
      case 'indigo': return `${baseClass} border-indigo-500`
      case 'teal': return `${baseClass} border-teal-500`
      default: return `${baseClass} border-blue-500`
    }
  }

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'metric':
        return (
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">1,234</div>
            <div className="text-sm text-muted-foreground">{widget.title}</div>
            {widget.config.showTrend && (
              <div className="text-xs text-green-600 mt-1">+12% ↑</div>
            )}
          </div>
        )
      case 'chart':
        return (
          <div className="h-32 flex items-center justify-center bg-muted/30 rounded">
            <div className="text-center">
              <LineChart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm text-muted-foreground">{widget.chartType} Chart</div>
            </div>
          </div>
        )
      case 'progress':
        return (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>75%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>
        )
      case 'activity_feed':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="truncate">New post published</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="truncate">Comment received</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="truncate">Content shared</span>
            </div>
          </div>
        )
      default:
        return (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Settings className="h-8 w-8 mx-auto mb-2" />
              <div className="text-sm">{widget.type} Widget</div>
            </div>
          </div>
        )
    }
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(getSizeClasses(widget.size), "relative group")}
    >
      <Card className={cn("h-full transition-shadow hover:shadow-md", getColorClasses(widget.color))}>
        <CardHeader 
          className="pb-2 cursor-grab active:cursor-grabbing" 
          {...attributes} 
          {...listeners}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium truncate">{widget.title}</CardTitle>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(widget)}
                className="h-6 w-6 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(widget.id)}
                className="h-6 w-6 p-0 text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {renderWidgetContent()}
        </CardContent>
      </Card>
    </div>
  )
}

export function CustomDashboard({ className }: CustomDashboardProps) {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)

  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [isAddingWidget, setIsAddingWidget] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dashboardName, setDashboardName] = useState('My Custom Dashboard')
  const [isEditing, setIsEditing] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load dashboard configuration on component mount
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/analytics/dashboards')
        if (response.ok) {
          const data = await response.json()
          const currentDashboard = data.dashboards[0]?.dashboards?.find((d: any) => d.isDefault || d.id === 'default')
          if (currentDashboard?.widgets) {
            setWidgets(currentDashboard.widgets)
            setDashboardName(currentDashboard.name || 'My Custom Dashboard')
          } else {
            // Set default widgets if no saved dashboard
            setWidgets([
              {
                id: '1',
                type: 'metric',
                title: 'Total Posts',
                metric: 'posts_published',
                size: 'small',
                color: 'blue',
                position: { x: 0, y: 0 },
                config: { showTrend: true }
              },
              {
                id: '2',
                type: 'chart',
                title: 'Engagement Trend',
                chartType: 'line',
                size: 'medium',
                color: 'green',
                position: { x: 1, y: 0 },
                config: { timeRange: '30d' }
              }
            ])
          }
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error)
        // Set default widgets on error
        setWidgets([
          {
            id: '1',
            type: 'metric',
            title: 'Total Posts',
            metric: 'posts_published',
            size: 'small',
            color: 'blue',
            position: { x: 0, y: 0 },
            config: { showTrend: true }
          }
        ])
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  // Save dashboard configuration when widgets change (debounced)
  useEffect(() => {
    if (!loading && widgets.length > 0) {
      const saveTimeout = setTimeout(async () => {
        try {
          await fetch('/api/analytics/dashboards', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: 'default',
              name: dashboardName,
              widgets,
              isDefault: true
            })
          })
        } catch (error) {
          console.error('Failed to save dashboard:', error)
        }
      }, 1000) // Debounce saves by 1 second

      return () => clearTimeout(saveTimeout)
    }
  }, [widgets, dashboardName, loading])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }

    setActiveId(null)
  }, [])

  const handleAddWidget = useCallback(() => {
    const newWidget: Widget = {
      id: Date.now().toString(),
      type: 'metric',
      title: 'New Widget',
      size: 'small',
      color: 'blue',
      position: { x: 0, y: 0 },
      config: {}
    }
    setEditingWidget(newWidget)
    setIsAddingWidget(true)
  }, [])

  const handleSaveWidget = useCallback((widget: Widget) => {
    if (isAddingWidget) {
      setWidgets(prev => [...prev, widget])
      setIsAddingWidget(false)
    } else {
      setWidgets(prev => prev.map(w => w.id === widget.id ? widget : w))
    }
    setEditingWidget(null)
  }, [isAddingWidget])

  const handleDeleteWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id))
  }, [])

  const handleDuplicateWidget = useCallback((widget: Widget) => {
    const newWidget = {
      ...widget,
      id: Date.now().toString(),
      title: `${widget.title} (Copy)`
    }
    setWidgets(prev => [...prev, newWidget])
  }, [])

  const handleResetDashboard = useCallback(() => {
    setWidgets([
      {
        id: '1',
        type: 'metric',
        title: 'Total Posts',
        metric: 'posts_published',
        size: 'small',
        color: 'blue',
        position: { x: 0, y: 0 },
        config: { showTrend: true }
      },
      {
        id: '2',
        type: 'chart',
        title: 'Engagement Trend',
        chartType: 'line',
        size: 'medium',
        color: 'green',
        position: { x: 1, y: 0 },
        config: { timeRange: '30d' }
      }
    ])
  }, [])

  const activeWidget = useMemo(
    () => widgets.find((widget) => widget.id === activeId),
    [activeId, widgets]
  )

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading dashboard...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Dashboard Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Layout className="h-5 w-5" />
                  {isEditing ? (
                    <Input
                      value={dashboardName}
                      onChange={(e) => setDashboardName(e.target.value)}
                      className="h-7 text-lg font-bold"
                      onBlur={() => setIsEditing(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="cursor-pointer hover:text-blue-600"
                      onClick={() => setIsEditing(true)}
                    >
                      {dashboardName}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-6 w-6 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Drag and drop widgets to customize your analytics dashboard
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleResetDashboard}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button onClick={handleAddWidget}>
                <Plus className="h-4 w-4 mr-1" />
                Add Widget
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dashboard Grid */}
      <div className="min-h-[600px]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-4 gap-4 auto-rows-fr">
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              {widgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  onEdit={setEditingWidget}
                  onDelete={handleDeleteWidget}
                />
              ))}
            </SortableContext>
          </div>
          <DragOverlay>
            {activeWidget ? (
              <div className="opacity-90">
                <SortableWidget
                  widget={activeWidget}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {widgets.length === 0 && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <div className="text-center">
              <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No widgets yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first widget to get started
              </p>
              <Button onClick={handleAddWidget}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Widget Editor Sheet */}
      <Sheet open={!!editingWidget} onOpenChange={(open) => !open && setEditingWidget(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>
              {isAddingWidget ? 'Add New Widget' : 'Edit Widget'}
            </SheetTitle>
            <SheetDescription>
              Configure your widget settings and appearance
            </SheetDescription>
          </SheetHeader>
          
          {editingWidget && (
            <WidgetEditor 
              widget={editingWidget}
              onSave={handleSaveWidget}
              onCancel={() => {
                setEditingWidget(null)
                setIsAddingWidget(false)
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Dashboard Stats */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>Widgets: {widgets.length}</span>
              <Badge variant="outline" className="flex items-center space-x-1">
                <Zap className="h-3 w-3" />
                <span>Custom Layout</span>
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span>Last modified: just now</span>
              <span>Auto-save: enabled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WidgetEditor({ widget, onSave, onCancel }: { 
  widget: Widget; 
  onSave: (widget: Widget) => void; 
  onCancel: () => void 
}) {
  const [editedWidget, setEditedWidget] = useState<Widget>(widget)

  const handleSave = () => {
    onSave(editedWidget)
  }

  const updateWidget = (updates: Partial<Widget>) => {
    setEditedWidget(prev => ({ ...prev, ...updates }))
  }

  const updateConfig = (configUpdates: Partial<Widget['config']>) => {
    setEditedWidget(prev => ({
      ...prev,
      config: { ...prev.config, ...configUpdates }
    }))
  }

  const selectedWidgetType = WIDGET_TYPES.find(wt => wt.type === editedWidget.type)

  return (
    <div className="space-y-6 py-6">
      {/* Basic Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Basic Settings</h3>
        
        <div>
          <Label htmlFor="widget-title">Widget Title</Label>
          <Input
            id="widget-title"
            value={editedWidget.title}
            onChange={(e) => updateWidget({ title: e.target.value })}
            placeholder="Enter widget title"
          />
        </div>

        <div>
          <Label>Widget Type</Label>
          <Select value={editedWidget.type} onValueChange={(value) => updateWidget({ type: value as WidgetType })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIDGET_TYPES.map((type) => (
                <SelectItem key={type.type} value={type.type}>
                  <div className="flex items-center space-x-2">
                    {type.icon}
                    <div>
                      <div>{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Size</Label>
            <Select value={editedWidget.size} onValueChange={(value) => updateWidget({ size: value as WidgetSize })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedWidgetType?.sizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    <div className="flex items-center space-x-2">
                      <Maximize className="h-3 w-3" />
                      <span className="capitalize">{size}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Color</Label>
            <Select value={editedWidget.color} onValueChange={(value) => updateWidget({ color: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center space-x-2">
                      <div className={cn("w-3 h-3 rounded-full", color.class)} />
                      <span>{color.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Type-specific Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Widget Configuration</h3>

        {editedWidget.type === 'metric' && (
          <div>
            <Label>Metric</Label>
            <Select value={editedWidget.metric} onValueChange={(value) => updateWidget({ metric: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a metric" />
              </SelectTrigger>
              <SelectContent>
                {METRICS_OPTIONS.map((metric) => (
                  <SelectItem key={metric.value} value={metric.value}>
                    <div className="flex items-center space-x-2">
                      {metric.icon}
                      <span>{metric.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {editedWidget.type === 'chart' && (
          <div>
            <Label>Chart Type</Label>
            <Select value={editedWidget.chartType} onValueChange={(value) => updateWidget({ chartType: value as ChartType })}>
              <SelectTrigger>
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((chart) => (
                  <SelectItem key={chart.value} value={chart.value}>
                    <div className="flex items-center space-x-2">
                      {chart.icon}
                      <span>{chart.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2 pt-4 border-t">
        <Button onClick={handleSave} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Save Widget
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}