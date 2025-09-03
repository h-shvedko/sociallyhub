'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { 
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Play,
  Pause,
  Calendar,
  Target,
  DollarSign,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Campaign, CampaignStatus } from '@/types/campaign'
import { cn } from '@/lib/utils'

interface CampaignCardProps {
  campaign: Campaign
  onEdit: (campaign: Campaign) => void
  onDelete: (campaignId: string) => void
  onDuplicate: (campaign: Campaign) => void
  onToggleStatus: (campaignId: string, status: CampaignStatus) => void
}

export function CampaignCard({ 
  campaign, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onToggleStatus 
}: CampaignCardProps) {
  const objectives = (campaign.objectives as any)?.objectives || []
  const budget = (campaign as any)?.budget || null  // Get budget from campaign.budget in database
  const status = campaign.status || 'DRAFT'  // Use campaign.status directly
  const abTesting = (campaign.objectives as any)?.abTesting
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200'
      case 'DRAFT': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'COMPLETED': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return Play
      case 'DRAFT': return Edit
      case 'SCHEDULED': return Calendar
      case 'PAUSED': return Pause
      case 'COMPLETED': return CheckCircle
      case 'CANCELLED': return AlertCircle
      default: return Clock
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const completedObjectives = objectives.filter((obj: any) => obj.isCompleted).length
  const objectiveProgress = objectives.length > 0 
    ? (completedObjectives / objectives.length) * 100 
    : 0

  const budgetProgress = budget?.totalBudget > 0 
    ? (budget.spentAmount / budget.totalBudget) * 100 
    : 0
    
  const remainingAmount = budget ? budget.totalBudget - budget.spentAmount : 0

  const StatusIcon = getStatusIcon(status)

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-base line-clamp-2 leading-tight">
              {campaign.name}
            </h3>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {campaign.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <Badge className={cn("text-xs", getStatusColor(status))}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.toLowerCase()}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(campaign)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {status === 'ACTIVE' ? (
                  <DropdownMenuItem onClick={() => onToggleStatus(campaign.id, CampaignStatus.PAUSED)}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </DropdownMenuItem>
                ) : status === 'PAUSED' ? (
                  <DropdownMenuItem onClick={() => onToggleStatus(campaign.id, CampaignStatus.ACTIVE)}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onToggleStatus(campaign.id, CampaignStatus.ACTIVE)}>
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(campaign.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Campaign Type & Client */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {((campaign.objectives as any)?.type || 'CUSTOM').replace('_', ' ')}
            </Badge>
            {campaign.client && (
              <Badge variant="outline" className="text-xs">
                {campaign.client.name}
              </Badge>
            )}
          </div>
          {abTesting?.isEnabled && (
            <Badge variant="secondary" className="text-xs">
              A/B Testing
            </Badge>
          )}
        </div>

        {/* Dates */}
        {(campaign.startDate || campaign.endDate) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {campaign.startDate && formatDate(campaign.startDate)}
              {campaign.startDate && campaign.endDate && ' - '}
              {campaign.endDate && formatDate(campaign.endDate)}
            </span>
          </div>
        )}

        {/* Objectives Progress */}
        {objectives.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Objectives</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {completedObjectives}/{objectives.length} completed
              </span>
            </div>
            <Progress value={objectiveProgress} className="h-2" />
            
            {/* Top 3 objectives */}
            <div className="space-y-1">
              {objectives.slice(0, 3).map((objective: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className={cn(
                    objective.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                  )}>
                    {objective.name}
                  </span>
                  <span className="text-muted-foreground">
                    {objective.currentValue}/{objective.targetValue} {objective.unit}
                  </span>
                </div>
              ))}
              {objectives.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{objectives.length - 3} more objectives
                </div>
              )}
            </div>
          </div>
        )}

        {/* Budget */}
        {budget && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Budget</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(budget.spentAmount)} / {formatCurrency(budget.totalBudget)}
              </span>
            </div>
            <Progress value={budgetProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{budgetProgress.toFixed(1)}% used</span>
              <span>{formatCurrency(remainingAmount)} remaining</span>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              <span>{(campaign as any).postCount || 0} posts</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(campaign.updatedAt)}</span>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onEdit(campaign)}>
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}