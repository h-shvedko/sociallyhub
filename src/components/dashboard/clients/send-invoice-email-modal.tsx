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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Send, Clock, Paperclip } from 'lucide-react'

interface SendInvoiceEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: any
  client: any
  onSend: (emailData: any) => Promise<void>
}

export function SendInvoiceEmailModal({ 
  open, 
  onOpenChange, 
  invoice, 
  client,
  onSend 
}: SendInvoiceEmailModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [emailData, setEmailData] = useState({
    to: client?.email || '',
    subject: `Invoice ${invoice?.invoiceNumber || ''} from SociallyHub`,
    body: `Dear ${client?.name || 'Valued Client'},

Thank you for choosing SociallyHub for your social media management needs. 

Please find attached your invoice ${invoice?.invoiceNumber || ''} for the amount of ${invoice?.currency || 'USD'} ${invoice?.total || 0}.

Payment is due by ${invoice?.dueDate || 'the specified date'}.

You can pay online at: [Payment Portal Link]

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
SociallyHub Team
Email: billing@sociallyhub.com
Phone: (555) 123-4567`
  })

  const handleSend = async () => {
    setIsLoading(true)
    try {
      await onSend({
        ...emailData,
        invoice,
        client
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error sending email:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice?.currency || 'USD'
    }).format(amount || 0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Invoice Email
          </DialogTitle>
          <DialogDescription>
            Send invoice {invoice?.invoiceNumber} to your client via email
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-4">
          {/* Invoice Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Invoice Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-blue-700">Invoice:</span>
                <span className="ml-2 font-medium">{invoice?.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-blue-700">Amount:</span>
                <span className="ml-2 font-medium">{formatCurrency(invoice?.total)}</span>
              </div>
              <div>
                <span className="text-blue-700">Client:</span>
                <span className="ml-2 font-medium">{client?.name}</span>
              </div>
              <div>
                <span className="text-blue-700">Due Date:</span>
                <span className="ml-2 font-medium">{invoice?.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Attachment Info */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Paperclip className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-700">
              Invoice PDF will be automatically attached
            </span>
            <Badge variant="secondary" className="ml-auto">PDF</Badge>
          </div>

          {/* Email Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                placeholder="client@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Invoice subject line"
                required
              />
            </div>

            <div>
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={emailData.body}
                onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Email message body"
                rows={12}
                className="resize-none"
                required
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading || !emailData.to || !emailData.subject}>
            {isLoading ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}