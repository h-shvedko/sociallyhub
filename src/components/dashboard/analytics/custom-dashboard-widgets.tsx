"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  DragEndEvent,
  DndContext,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy
} from '@dnd-kit/sortable'
import {
  CSS
} from '@dnd-kit/utilities'
import { 
  Plus,
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Users,
  TrendingUp,
  Heart,
  MessageCircle,
  Clock,
  Target,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CustomLineChart, CustomBarChart, CustomPieChart, CustomAreaChart } from "./chart-components"
import { DefaultAnalyticsCards, SocialMediaAnalyticsCards, PerformanceAnalyticsCards } from "./analytics-overview-cards"

interface Widget {
  id: string
  type: 'chart' | 'metric' | 'list' | 'custom'
  title: string
  description?: string
  position: { x: number, y: number }
  size: { width: number, height: number }
  config: any
  visible: boolean
  chartType?: 'line' | 'bar' | 'pie' | 'area'
  dataSource: string
  refreshRate?: number
}

interface DashboardLayout {
  id: string
  name: string
  widgets: Widget[]
  columns: number
  description?: string
}

const WIDGET_TEMPLATES = [
  {
    id: 'user-metrics',
    name: 'User Metrics',
    type: 'metric' as const,
    icon: <Users className="h-4 w-4" />,
    description: 'Display user-related statistics',
    defaultConfig: {
      metrics: ['total-users', 'active-users', 'new-users'],
      timeframe: '30d'
    }
  },
  {
    id: 'engagement-chart',
    name: 'Engagement Chart',
    type: 'chart' as const,
    icon: <LineChart className="h-4 w-4" />,
    description: 'Line chart showing engagement trends',
    defaultConfig: {
      chartType: 'line',
      dataKeys: ['likes', 'comments', 'shares'],
      timeframe: '7d'
    }
  },
  {
    id: 'platform-breakdown',
    name: 'Platform Breakdown',
    type: 'chart' as const,
    icon: <PieChart className="h-4 w-4" />,
    description: 'Pie chart of platform distribution',
    defaultConfig: {
      chartType: 'pie',
      dataSource: 'platforms',
      timeframe: '30d'
    }
  },
  {
    id: 'performance-bars',
    name: 'Performance Comparison',
    type: 'chart' as const,
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Bar chart comparing performance metrics',
    defaultConfig: {
      chartType: 'bar',
      dataKeys: ['reach', 'impressions', 'engagement'],
      timeframe: '30d'
    }
  },
  {
    id: 'social-media-cards',
    name: 'Social Media Cards',
    type: 'metric' as const,
    icon: <Heart className="h-4 w-4" />,
    description: 'Social media specific metrics',
    defaultConfig: {
      cardType: 'social',
      timeframe: '7d'
    }
  },
  {
    id: 'real-time-activity',
    name: 'Real-time Activity',
    type: 'custom' as const,
    icon: <Activity className="h-4 w-4" />,
    description: 'Live activity feed and metrics',
    defaultConfig: {
      showFeed: true,
      updateInterval: 5000
    }
  }
]

interface SortableWidgetProps {
  widget: Widget
  onEdit: (widget: Widget) => void
  onToggleVisibility: (id: string) => void
  onDelete: (id: string) => void
}

function SortableWidget({ widget, onEdit, onToggleVisibility, onDelete }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        isDragging && "opacity-50",
        !widget.visible && "opacity-60"
      )}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div 
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                {widget.description && (
                  <CardDescription className="text-xs">{widget.description}</CardDescription>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleVisibility(widget.id)}
                className="h-6 w-6 p-0"
              >
                {widget.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
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
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <WidgetRenderer widget={widget} />
        </CardContent>
      </Card>
    </div>
  )
}

interface WidgetRendererProps {
  widget: Widget
}

function WidgetRenderer({ widget }: WidgetRendererProps) {
  // Mock data for demonstration
  const mockChartData = [
    { date: 'Jan', likes: 100, comments: 30, shares: 20, reach: 1500, impressions: 3000, engagement: 150 },
    { date: 'Feb', likes: 120, comments: 40, shares: 25, reach: 1800, impressions: 3500, engagement: 185 },
    { date: 'Mar', likes: 150, comments: 50, shares: 30, reach: 2100, impressions: 4000, engagement: 230 },
    { date: 'Apr', likes: 130, comments: 35, shares: 22, reach: 1900, impressions: 3700, engagement: 187 },
    { date: 'May', likes: 180, comments: 60, shares: 40, reach: 2500, impressions: 4800, engagement: 280 }
  ]

  const mockPieData = [
    { name: 'Twitter', value: 30, color: '#1DA1F2' },
    { name: 'Instagram', value: 35, color: '#E4405F' },
    { name: 'LinkedIn', value: 20, color: '#0077B5' },
    { name: 'Facebook', value: 15, color: '#4267B2' }
  ]

  const mockMetricsData = {
    totalUsers: 2847,
    activeUsers: 1250,
    newUsers: 156,
    sessionDuration: 245,
    engagementRate: 7.2,
    totalFollowers: 15400,
    postEngagement: 1850,
    totalShares: 720,
    totalComments: 450,
    avgResponseTime: 245,
    uptime: 99.9,
    throughput: 1200,
    errorRate: 0.1
  }

  if (!widget.visible) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground bg-muted/20 rounded">
        <EyeOff className="h-6 w-6" />
      </div>
    )
  }

  switch (widget.type) {
    case 'chart':
      const { chartType, dataKeys } = widget.config
      switch (chartType) {
        case 'line':
          return (
            <div className="h-48">
              <CustomLineChart
                data={mockChartData}
                dataKeys={dataKeys || ['likes', 'comments']}
                title=""
                height={180}
                showGrid={false}
                showLegend={false}
              />
            </div>
          )
        case 'bar':
          return (
            <div className="h-48">
              <CustomBarChart
                data={mockChartData}
                dataKeys={dataKeys || ['reach', 'impressions']}
                title=""
                height={180}
                showGrid={false}
              />
            </div>
          )
        case 'pie':
          return (
            <div className="h-48">
              <CustomPieChart
                data={mockPieData}
                dataKey="value"
                nameKey="name"
                title=""
                height={180}
                showLegend={false}
              />
            </div>
          )
        case 'area':
          return (
            <div className="h-48">
              <CustomAreaChart
                data={mockChartData}
                dataKeys={dataKeys || ['engagement']}
                title=""
                height={180}
                showGrid={false}
                stacked={false}
              />
            </div>
          )
        default:
          return <div className="h-32 bg-muted/20 rounded flex items-center justify-center text-muted-foreground">Chart</div>
      }

    case 'metric':
      const { cardType } = widget.config
      switch (cardType) {
        case 'social':
          return <SocialMediaAnalyticsCards data={mockMetricsData} />
        case 'performance':
          return <PerformanceAnalyticsCards data={mockMetricsData} />
        default:
          return <DefaultAnalyticsCards data={mockMetricsData} />
      }

    case 'custom':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Live Activity</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>127 users currently active</div>
            <div>23 new sessions in last 5 min</div>
            <div>156 page views in last hour</div>
          </div>
        </div>
      )

    default:
      return <div className="h-32 bg-muted/20 rounded flex items-center justify-center text-muted-foreground">Widget</div>
  }
}

export function CustomDashboardWidgets() {
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>({
    id: 'default',
    name: 'My Dashboard',
    columns: 3,
    widgets: [
      {
        id: '1',
        type: 'metric',
        title: 'User Metrics',
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 },
        config: { cardType: 'default' },
        visible: true,
        dataSource: 'users'
      },
      {
        id: '2',
        type: 'chart',
        title: 'Engagement Trend',
        position: { x: 1, y: 0 },
        size: { width: 2, height: 1 },
        config: { chartType: 'line', dataKeys: ['likes', 'comments', 'shares'] },
        visible: true,
        dataSource: 'engagement'
      }
    ]
  })

  const [activeWidget, setActiveWidget] = useState<string | null>(null)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [isAddingWidget, setIsAddingWidget] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveWidget(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setDashboardLayout(layout => {
        const oldIndex = layout.widgets.findIndex(widget => widget.id === active.id)
        const newIndex = layout.widgets.findIndex(widget => widget.id === over?.id)

        return {
          ...layout,
          widgets: arrayMove(layout.widgets, oldIndex, newIndex)
        }
      })
    }

    setActiveWidget(null)
  }, [])

  const addWidget = (templateId: string) => {
    const template = WIDGET_TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: template.type,
      title: template.name,
      description: template.description,
      position: { x: 0, y: dashboardLayout.widgets.length },
      size: { width: 1, height: 1 },
      config: template.defaultConfig,
      visible: true,
      dataSource: template.id
    }

    setDashboardLayout(layout => ({
      ...layout,
      widgets: [...layout.widgets, newWidget]
    }))

    setIsAddingWidget(false)
  }

  const editWidget = (widget: Widget) => {
    setEditingWidget(widget)
  }

  const saveWidget = (updatedWidget: Widget) => {
    setDashboardLayout(layout => ({
      ...layout,
      widgets: layout.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w)
    }))
    setEditingWidget(null)
  }

  const toggleWidgetVisibility = (widgetId: string) => {
    setDashboardLayout(layout => ({
      ...layout,
      widgets: layout.widgets.map(w => 
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      )
    }))
  }

  const deleteWidget = (widgetId: string) => {
    setDashboardLayout(layout => ({
      ...layout,
      widgets: layout.widgets.filter(w => w.id !== widgetId)
    }))
  }

  const activeWidgetData = dashboardLayout.widgets.find(w => w.id === activeWidget)

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Dashboard</CardTitle>
              <CardDescription>
                Drag and drop widgets to customize your analytics dashboard
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {dashboardLayout.widgets.filter(w => w.visible).length} active widgets
              </Badge>
              <Dialog open={isAddingWidget} onOpenChange={setIsAddingWidget}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Widget
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Widget</DialogTitle>
                    <DialogDescription>
                      Choose from available widget templates
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    {WIDGET_TEMPLATES.map((template) => (
                      <Card 
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => addWidget(template.id)}
                      >
                        <CardHeader>
                          <div className="flex items-center space-x-2">
                            {template.icon}
                            <CardTitle className="text-base">{template.name}</CardTitle>
                          </div>
                          <CardDescription className="text-sm">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={dashboardLayout.widgets.map(w => w.id)} 
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardLayout.widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onEdit={editWidget}
                onToggleVisibility={toggleWidgetVisibility}
                onDelete={deleteWidget}
              />
            ))}
            {dashboardLayout.widgets.length === 0 && (
              <div className="col-span-full">
                <Card className="border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">
                      No widgets added yet
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add your first widget to start customizing your dashboard
                    </p>
                    <Button onClick={() => setIsAddingWidget(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Widget
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </SortableContext>
        
        <DragOverlay>
          {activeWidget ? (
            <Card className="opacity-80 rotate-2 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{activeWidgetData?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted/50 rounded" />
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Widget Editor */}
      {editingWidget && (
        <Dialog open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Widget</DialogTitle>
              <DialogDescription>
                Customize widget settings and appearance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Widget Title</Label>
                <Input 
                  value={editingWidget.title}
                  onChange={(e) => setEditingWidget({ ...editingWidget, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={editingWidget.description || ''}
                  onChange={(e) => setEditingWidget({ ...editingWidget, description: e.target.value })}
                />
              </div>

              {editingWidget.type === 'chart' && (
                <div className="space-y-2">
                  <Label>Chart Type</Label>
                  <Select 
                    value={editingWidget.config.chartType}
                    onValueChange={(value) => setEditingWidget({ 
                      ...editingWidget, 
                      config: { ...editingWidget.config, chartType: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="area">Area Chart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch 
                  id="visible"
                  checked={editingWidget.visible}
                  onCheckedChange={(checked) => setEditingWidget({ ...editingWidget, visible: checked })}
                />
                <Label htmlFor="visible">Visible</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingWidget(null)}>
                  Cancel
                </Button>
                <Button onClick={() => saveWidget(editingWidget)}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}