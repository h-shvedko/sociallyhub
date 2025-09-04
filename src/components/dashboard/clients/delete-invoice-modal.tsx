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
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Receipt,
  Trash2
} from 'lucide-react'

interface DeleteInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: any | null
  onConfirm: () => void
  isLoading?: boolean
}

export function DeleteInvoiceModal({
  open,
  onOpenChange,
  invoice,
  onConfirm,
  isLoading = false
}: DeleteInvoiceModalProps) {
  if (!invoice) return null

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Invoice
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this invoice? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Summary */}
          <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-l-red-500">
            <div className="flex items-center gap-3 mb-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{invoice.invoiceNumber}</span>
              <Badge className={getStatusColor(invoice.status)}>
                {invoice.status.toUpperCase()}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><span className="font-medium">Client:</span> {invoice.clientName}</p>
              <p><span className="font-medium">Amount:</span> {formatCurrency(invoice.amount, invoice.currency)}</p>
              <p><span className="font-medium">Due:</span> {new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Warning Message */}
          <div className="flex items-start gap-3 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Warning:</p>
              <p>
                Deleting this invoice will permanently remove it from your system. 
                If this invoice has been sent to the client or if payment has been received, 
                consider updating the status instead of deleting.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Trash2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}