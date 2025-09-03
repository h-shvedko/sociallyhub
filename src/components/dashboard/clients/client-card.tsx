'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building,
  Mail,
  Phone,
  Globe,
  Calendar,
  DollarSign,
  Users,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  MessageSquare,
  Clock,
  Star
} from 'lucide-react'
import { 
  Client, 
  ClientStatus, 
  OnboardingStatus, 
  ServiceLevel 
} from '@/types/client'

interface ClientCardProps {
  client: Client
  showOnboardingStatus?: boolean
  onView?: (client: Client) => void
  onEdit?: (client: Client) => void
  onDelete?: (client: Client) => void
  onMessage?: (client: Client) => void
}

export function ClientCard({ 
  client, 
  showOnboardingStatus = false,
  onView,
  onEdit,
  onDelete,
  onMessage
}: ClientCardProps) {
  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case ClientStatus.ACTIVE:
        return 'bg-green-100 text-green-800 border-green-200'
      case ClientStatus.PROSPECT:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case ClientStatus.ON_HOLD:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case ClientStatus.CHURNED:
        return 'bg-red-100 text-red-800 border-red-200'
      case ClientStatus.ARCHIVED:
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getOnboardingColor = (status: OnboardingStatus) => {
    switch (status) {
      case OnboardingStatus.COMPLETED:
        return 'bg-green-100 text-green-800 border-green-200'
      case OnboardingStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case OnboardingStatus.STALLED:
        return 'bg-red-100 text-red-800 border-red-200'
      case OnboardingStatus.NOT_STARTED:
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getServiceLevelColor = (level?: ServiceLevel) => {
    switch (level) {
      case ServiceLevel.ENTERPRISE:
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case ServiceLevel.PREMIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case ServiceLevel.STANDARD:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case ServiceLevel.BASIC:
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          {/* Left side - Main info */}
          <div className="flex items-start gap-4 flex-1">
            <Avatar className="h-12 w-12">
              <AvatarImage src={client.logo} />
              <AvatarFallback className="bg-primary/10">
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold truncate">
                    {client.name}
                  </h3>
                  {client.company && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Building className="h-3 w-3" />
                      {client.company}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Badge className={getStatusColor(client.status)}>
                    {client.status.toLowerCase().replace('_', ' ')}
                  </Badge>
                  {showOnboardingStatus && (
                    <Badge variant="outline" className={getOnboardingColor(client.onboardingStatus)}>
                      {client.onboardingStatus.toLowerCase().replace('_', ' ')}
                    </Badge>
                  )}
                  {client.contractDetails?.serviceLevel && (
                    <Badge variant="outline" className={getServiceLevelColor(client.contractDetails.serviceLevel)}>
                      {client.contractDetails.serviceLevel.toLowerCase()}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <a 
                      href={client.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Website
                    </a>
                  </div>
                )}
                {client.industry && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Industry:</span>
                    <span>{client.industry}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {client.tags && client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {client.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Additional Info Row */}
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Created {formatDate(client.createdAt)}</span>
                </div>
                
                {client.lastContactDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Last contact {formatDate(client.lastContactDate)}</span>
                  </div>
                )}
                
                {client.billingInfo?.contractValue && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span>
                      {formatCurrency(client.billingInfo.contractValue, client.billingInfo.currency)}
                      {client.billingInfo.billingCycle === 'MONTHLY' && '/mo'}
                      {client.billingInfo.billingCycle === 'ANNUAL' && '/yr'}
                    </span>
                  </div>
                )}
                
                {client.contractDetails?.included.teamMembers && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{client.contractDetails.included.teamMembers} users</span>
                  </div>
                )}
              </div>

              {/* Notes Preview */}
              {client.notes && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    <span className="font-medium">Notes:</span> {client.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={() => onMessage?.(client)}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView?.(client)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(client)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Client
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMessage?.(client)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.(client)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}