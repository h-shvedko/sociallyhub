'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertCircle,
  Send,
  Receipt,
  Calendar,
  DollarSign
} from 'lucide-react'

interface SendReminderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: any | null
  onSend: (reminderData: { message: string }) => void
  isLoading?: boolean
}

export function SendReminderModal({
  open,
  onOpenChange,
  invoice,
  onSend,
  isLoading = false
}: SendReminderModalProps) {
  const [message, setMessage] = useState('')

  React.useEffect(() => {
    if (open && invoice) {
      // Generate default reminder message
      const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24))
      const overdueText = daysOverdue > 0 ? `${daysOverdue} days overdue` : 'due soon'
      
      const defaultMessage = `Dear ${invoice.clientName},

I hope this email finds you well. I wanted to follow up regarding invoice ${invoice.invoiceNumber} in the amount of ${formatCurrency(invoice.amount, invoice.currency)}, which is currently ${overdueText}.

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Amount: ${formatCurrency(invoice.amount, invoice.currency)}
- Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

If you have already sent payment, please disregard this reminder. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out.

Thank you for your prompt attention to this matter.

Best regards,
SociallyHub Team`

      setMessage(defaultMessage)
    }
  }, [open, invoice])

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

  const handleSend = () => {
    onSend({ message })
  }

  if (!invoice) return null

  const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Send Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Send a payment reminder email to your client for this overdue invoice
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {/* Invoice Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(invoice.status)}>
                  {invoice.status.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-muted-foreground">Days Overdue</p>
                    <p className="font-medium text-red-600">
                      {daysOverdue > 0 ? `${daysOverdue} days` : 'Due soon'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reminder Message */}
          <div className="space-y-2">
            <Label htmlFor="reminder-message">Reminder Message</Label>
            <Textarea
              id="reminder-message"
              placeholder="Enter your reminder message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will be sent to {invoice.clientEmail || invoice.clientName}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Reminder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}