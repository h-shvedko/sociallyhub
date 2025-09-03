"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

// Theme-aware colors
const useChartColors = () => {
  const { theme, resolvedTheme } = useTheme()
  const currentTheme = resolvedTheme || theme || 'light'

  return useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
        danger: '#EF4444',
        warning: '#F97316',
        success: '#22C55E',
        info: '#06B6D4',
        purple: '#8B5CF6',
        pink: '#EC4899',
        grid: '#374151',
        text: '#F9FAFB',
        muted: '#6B7280',
        background: '#1F2937',
        cardBackground: '#111827'
      }
    } else {
      return {
        primary: '#2563EB',
        secondary: '#059669',
        accent: '#D97706',
        danger: '#DC2626',
        warning: '#EA580C',
        success: '#16A34A',
        info: '#0891B2',
        purple: '#7C3AED',
        pink: '#DB2777',
        grid: '#E5E7EB',
        text: '#111827',
        muted: '#6B7280',
        background: '#FFFFFF',
        cardBackground: '#F9FAFB'
      }
    }
  }, [currentTheme])
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, colors }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="text-sm font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value.toLocaleString()}`}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Line Chart Component
interface LineChartProps {
  data: any[]
  dataKeys: string[]
  title: string
  description?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  yAxisLabel?: string
  xAxisKey?: string
}

export function CustomLineChart({
  data,
  dataKeys,
  title,
  description,
  height = 300,
  showGrid = true,
  showLegend = true,
  yAxisLabel,
  xAxisKey = 'date'
}: LineChartProps) {
  const colors = useChartColors()
  const chartColors = [colors.primary, colors.secondary, colors.accent, colors.purple, colors.pink]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />}
            <XAxis 
              dataKey={xAxisKey} 
              stroke={colors.muted}
              fontSize={12}
            />
            <YAxis 
              stroke={colors.muted}
              fontSize={12}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip colors={colors} />} />
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[index % chartColors.length]}
                strokeWidth={2}
                dot={{ fill: chartColors[index % chartColors.length], r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Area Chart Component
interface AreaChartProps {
  data: any[]
  dataKeys: string[]
  title: string
  description?: string
  height?: number
  stacked?: boolean
  showGrid?: boolean
  yAxisLabel?: string
  xAxisKey?: string
}

export function CustomAreaChart({
  data,
  dataKeys,
  title,
  description,
  height = 300,
  stacked = false,
  showGrid = true,
  yAxisLabel,
  xAxisKey = 'date'
}: AreaChartProps) {
  const colors = useChartColors()
  const chartColors = [colors.primary, colors.secondary, colors.accent, colors.purple, colors.pink]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />}
            <XAxis 
              dataKey={xAxisKey} 
              stroke={colors.muted}
              fontSize={12}
            />
            <YAxis 
              stroke={colors.muted}
              fontSize={12}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip colors={colors} />} />
            <Legend />
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId={stacked ? "1" : undefined}
                stroke={chartColors[index % chartColors.length]}
                fill={chartColors[index % chartColors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Bar Chart Component
interface BarChartProps {
  data: any[]
  dataKeys: string[]
  title: string
  description?: string
  height?: number
  horizontal?: boolean
  stacked?: boolean
  showGrid?: boolean
  yAxisLabel?: string
  xAxisKey?: string
}

export function CustomBarChart({
  data,
  dataKeys,
  title,
  description,
  height = 300,
  horizontal = false,
  stacked = false,
  showGrid = true,
  yAxisLabel,
  xAxisKey = 'name'
}: BarChartProps) {
  const colors = useChartColors()
  const chartColors = [colors.primary, colors.secondary, colors.accent, colors.purple, colors.pink]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart 
            data={data}
            layout={horizontal ? 'horizontal' : 'vertical'}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />}
            <XAxis 
              type={horizontal ? 'number' : 'category'}
              dataKey={horizontal ? undefined : xAxisKey}
              stroke={colors.muted}
              fontSize={12}
            />
            <YAxis 
              type={horizontal ? 'category' : 'number'}
              dataKey={horizontal ? xAxisKey : undefined}
              stroke={colors.muted}
              fontSize={12}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip colors={colors} />} />
            <Legend />
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                stackId={stacked ? "1" : undefined}
                fill={chartColors[index % chartColors.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Pie Chart Component
interface PieChartProps {
  data: any[]
  dataKey: string
  nameKey: string
  title: string
  description?: string
  height?: number
  showLegend?: boolean
  innerRadius?: number
}

export function CustomPieChart({
  data,
  dataKey,
  nameKey,
  title,
  description,
  height = 300,
  showLegend = true,
  innerRadius = 0
}: PieChartProps) {
  const colors = useChartColors()
  const chartColors = [
    colors.primary, colors.secondary, colors.accent, colors.purple, 
    colors.pink, colors.success, colors.warning, colors.info
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={innerRadius}
              fill="#8884d8"
              dataKey={dataKey}
              nameKey={nameKey}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip colors={colors} />} />
            {showLegend && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Composed Chart (Line + Bar combination)
interface ComposedChartProps {
  data: any[]
  lineKeys: string[]
  barKeys: string[]
  title: string
  description?: string
  height?: number
  showGrid?: boolean
  yAxisLabel?: string
  xAxisKey?: string
}

export function CustomComposedChart({
  data,
  lineKeys,
  barKeys,
  title,
  description,
  height = 300,
  showGrid = true,
  yAxisLabel,
  xAxisKey = 'date'
}: ComposedChartProps) {
  const colors = useChartColors()
  const chartColors = [colors.primary, colors.secondary, colors.accent, colors.purple, colors.pink]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />}
            <XAxis 
              dataKey={xAxisKey} 
              stroke={colors.muted}
              fontSize={12}
            />
            <YAxis 
              stroke={colors.muted}
              fontSize={12}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip colors={colors} />} />
            <Legend />
            {barKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={chartColors[index % chartColors.length]}
                fillOpacity={0.8}
                radius={[2, 2, 0, 0]}
              />
            ))}
            {lineKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[(index + barKeys.length) % chartColors.length]}
                strokeWidth={2}
                dot={{ fill: chartColors[(index + barKeys.length) % chartColors.length], r: 4 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Metric Comparison Chart
interface MetricComparisonProps {
  data: any[]
  title: string
  description?: string
  height?: number
  targetValue?: number
  targetLabel?: string
}

export function MetricComparisonChart({
  data,
  title,
  description,
  height = 300,
  targetValue,
  targetLabel = "Target"
}: MetricComparisonProps) {
  const colors = useChartColors()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis 
              dataKey="date" 
              stroke={colors.muted}
              fontSize={12}
            />
            <YAxis 
              stroke={colors.muted}
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip colors={colors} />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="current"
              stroke={colors.primary}
              strokeWidth={2}
              dot={{ fill: colors.primary, r: 4 }}
              name="Current"
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke={colors.muted}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: colors.muted, r: 4 }}
              name="Previous Period"
            />
            {targetValue && (
              <ReferenceLine 
                y={targetValue} 
                stroke={colors.success}
                strokeDasharray="8 8"
                label={targetLabel}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Real-time updating chart wrapper
interface RealTimeChartProps {
  children: React.ReactNode
  updateInterval?: number
  onUpdate?: () => void
}

export function RealTimeChart({ 
  children, 
  updateInterval = 30000, 
  onUpdate 
}: RealTimeChartProps) {
  // Real-time update logic would be implemented here
  // For now, it's just a wrapper that can be extended
  
  return (
    <div className="relative">
      {children}
      <div className="absolute top-2 right-2">
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live</span>
        </div>
      </div>
    </div>
  )
}