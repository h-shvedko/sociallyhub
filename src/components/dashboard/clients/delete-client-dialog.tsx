'use client'

import React, { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  AlertTriangle, 
  Loader2, 
  Trash2,
  Users,
  BarChart3,
  FileText,
  DollarSign
} from 'lucide-react'
import { Client } from '@/types/client'

interface DeleteClientDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientDeleted: (clientId: string) => void
}

export function DeleteClientDialog({ client, open, onOpenChange, onClientDeleted }: DeleteClientDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')

  const handleDelete = async () => {
    if (!client || confirmationText !== client.name) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: client.workspaceId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete client')
      }

      onClientDeleted(client.id)
      onOpenChange(false)
      setConfirmationText('')
    } catch (error) {
      console.error('Error deleting client:', error)
      // You could add toast notification here
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleCancel = () => {
    setConfirmationText('')
    onOpenChange(false)
  }

  if (!client) return null

  const isConfirmationValid = confirmationText === client.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg text-red-900">Delete Client</DialogTitle>
              <DialogDescription className="text-red-700">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Info */}
          <Card className="border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={client.logo} alt={client.name} />
                  <AvatarFallback className="bg-red-100 text-red-700">
                    {getInitials(client.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-900 truncate">{client.name}</p>
                  <p className="text-sm text-red-700">
                    {client.company && client.company !== client.name && client.company}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Created {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning about data loss */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-900">
                  The following data will be permanently deleted:
                </p>
                <ul className="text-xs text-red-700 space-y-1 pl-3">
                  <li className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Client information and contact details
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart3 className="h-3 w-3" />
                    Analytics and performance data
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Posts and campaign history
                  </li>
                  <li className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3" />
                    Billing and contract information
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Stats to be deleted */}
          {(client.socialAccountsCount || client.campaignsCount || client.postsCount) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-900 mb-2">Associated Data:</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold text-yellow-800">{client.socialAccountsCount || 0}</p>
                  <p className="text-xs text-yellow-700">Social Accounts</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-yellow-800">{client.campaignsCount || 0}</p>
                  <p className="text-xs text-yellow-700">Campaigns</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-yellow-800">{client.postsCount || 0}</p>
                  <p className="text-xs text-yellow-700">Posts</p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-sm font-medium text-gray-900">
              To confirm deletion, type the client name: <span className="font-semibold text-red-600">{client.name}</span>
            </Label>
            <Input
              id="confirm"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={client.name}
              className="border-red-300 focus:border-red-500 focus:ring-red-500"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || !isConfirmationValid}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Client
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}