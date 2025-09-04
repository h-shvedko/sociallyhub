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
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Receipt,
  Calendar,
  DollarSign,
  User,
  FileText,
  Download,
  Send,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'

interface InvoiceDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: any | null
  onDownload?: () => void
  onSendReminder?: () => void
  onStatusUpdate?: (newStatus: string) => void
}

export function InvoiceDetailsModal({
  open,
  onOpenChange,
  invoice,
  onDownload,
  onSendReminder,
  onStatusUpdate
}: InvoiceDetailsModalProps) {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoice Details - {invoice.invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            Complete invoice information and available actions
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
          {/* Invoice Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(invoice.status)}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(invoice.status)}
                    {invoice.status.toUpperCase()}
                  </div>
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-2xl font-bold">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Due Date</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium">Name: </span>
                <span>{invoice.clientName}</span>
              </div>
              {invoice.clientEmail && (
                <div>
                  <span className="text-sm font-medium">Email: </span>
                  <span>{invoice.clientEmail}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Invoice Number:</span>
                  <p className="font-mono">{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Issue Date:</span>
                  <p>{new Date(invoice.issuedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Due Date:</span>
                  <p>{new Date(invoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Currency:</span>
                  <p>{invoice.currency}</p>
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Services</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span>Social Media Management Services</span>
                    <span className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(invoice.amount, invoice.currency)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex items-center gap-2 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            
            <div className="flex-1" />
            
            {invoice.status === 'draft' && onStatusUpdate && (
              <Button 
                variant="outline" 
                onClick={() => onStatusUpdate('pending')}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            
            {(invoice.status === 'pending' || invoice.status === 'overdue') && onStatusUpdate && (
              <Button 
                variant="outline" 
                onClick={() => onStatusUpdate('paid')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
            )}
            
            {(invoice.status === 'pending' || invoice.status === 'overdue') && onSendReminder && (
              <Button 
                variant="outline" 
                onClick={onSendReminder}
                className="text-orange-600 hover:text-orange-700"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
            )}
            
            {onDownload && (
              <Button onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}