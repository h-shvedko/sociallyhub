'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react'

interface NotificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'success' | 'error'
  title: string
  message: string
}

export function NotificationModal({
  open,
  onOpenChange,
  type,
  title,
  message
}: NotificationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${
            type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription className={`p-4 rounded-lg ${
            type === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}