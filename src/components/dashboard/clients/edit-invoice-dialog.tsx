'use client'

import React, { useState, useEffect } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Receipt,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  Save
} from 'lucide-react'

interface EditInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: any | null
  onInvoiceUpdated?: (updatedInvoice: any) => void
}

interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export function EditInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onInvoiceUpdated
}: EditInvoiceDialogProps) {
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    amount: 0,
    dueDate: '',
    notes: '',
    status: 'draft',
    currency: 'USD'
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [tax, setTax] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && invoice) {
      setFormData({
        clientName: invoice.clientName || '',
        clientEmail: invoice.clientEmail || '',
        amount: invoice.amount || 0,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
        notes: invoice.notes || '',
        status: invoice.status || 'draft',
        currency: invoice.currency || 'USD'
      })
      
      // Set up line items - use existing ones or create default
      if (invoice.lineItems && invoice.lineItems.length > 0) {
        setLineItems(invoice.lineItems.map((item: any, index: number) => ({
          id: `item-${index}`,
          description: item.description || 'Social Media Management Services',
          quantity: item.quantity || 1,
          rate: item.rate || invoice.amount || 0,
          amount: item.amount || invoice.amount || 0
        })))
      } else {
        setLineItems([{
          id: 'item-0',
          description: 'Social Media Management Services',
          quantity: 1,
          rate: invoice.amount || 0,
          amount: invoice.amount || 0
        }])
      }

      setTax(invoice.tax || 0)
      setDiscount(invoice.discount || 0)
    }
  }, [open, invoice])

  const addLineItem = () => {
    const newItem: LineItem = {
      id: `item-${lineItems.length}`,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }
    setLineItems([...lineItems, newItem])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(items =>
      items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate
          }
          return updated
        }
        return item
      })
    )
  }

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxAmount = subtotal * (tax / 100)
    const total = subtotal + taxAmount - discount
    return { subtotal, taxAmount, total }
  }

  const handleSave = async () => {
    if (!invoice) return
    
    setIsLoading(true)
    try {
      const { total } = calculateTotals()
      
      const updateData = {
        amount: total,
        dueDate: formData.dueDate,
        notes: formData.notes,
        status: formData.status,
        currency: formData.currency,
        lineItems: lineItems,
        tax: tax,
        discount: discount
      }

      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        throw new Error('Failed to update invoice')
      }

      const result = await response.json()
      
      if (result.success && onInvoiceUpdated) {
        onInvoiceUpdated(result.invoice)
      }

      onOpenChange(false)
      console.log('✅ Invoice updated successfully')
    } catch (error) {
      console.error('Error updating invoice:', error)
      // Handle error - in a real implementation this should use a notification system
    } finally {
      setIsLoading(false)
    }
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

  if (!invoice) return null

  const { subtotal, taxAmount, total } = calculateTotals()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Edit Invoice - {invoice.invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            Update invoice details, line items, and billing information
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
          {/* Invoice Status and Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Information
                </span>
                <Badge className={getStatusColor(formData.status)}>
                  {formData.status.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client Name</Label>
                  <Input
                    value={formData.clientName}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label>Client Email</Label>
                  <Input
                    value={formData.clientEmail}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={formData.currency} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, currency: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes or payment terms..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Services & Items
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-4 border rounded">
                  <div className="col-span-5">
                    <Label>Description</Label>
                    <Input
                      placeholder="Service or item description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Rate</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Amount</Label>
                    <div className="font-medium text-lg">
                      ${item.amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Tax and Discount */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Discount ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({tax}%):</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}