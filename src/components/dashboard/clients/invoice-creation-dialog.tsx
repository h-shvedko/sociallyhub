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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Receipt,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  Download,
  Send,
  Clock,
  CreditCard
} from 'lucide-react'

interface InvoiceCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients?: any[]
  onInvoiceCreated?: (invoiceData: any) => void
}

interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export function InvoiceCreationDialog({ 
  open, 
  onOpenChange, 
  clients = [],
  onInvoiceCreated 
}: InvoiceCreationDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: `INV-${Date.now()}`,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'USD',
    notes: '',
    terms: 'Net 30 days',
    tax: 0,
    discount: 0
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: 'Social Media Management Services',
      quantity: 1,
      rate: 2500,
      amount: 2500
    }
  ])

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }
    setLineItems([...lineItems, newItem])
  }

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id))
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = updatedItem.quantity * updatedItem.rate
        }
        return updatedItem
      }
      return item
    }))
  }

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0)
  }

  const calculateTax = () => {
    return (calculateSubtotal() * invoiceData.tax) / 100
  }

  const calculateDiscount = () => {
    return (calculateSubtotal() * invoiceData.discount) / 100
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - calculateDiscount()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoiceData.currency
    }).format(amount)
  }

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    setSelectedClient(client)
  }

  const handleCreateInvoice = async () => {
    if (!selectedClient) {
      alert('Please select a client')
      return
    }

    if (lineItems.length === 0 || lineItems.some(item => !item.description || item.rate <= 0)) {
      alert('Please add valid line items')
      return
    }

    setIsLoading(true)
    try {
      const invoicePayload = {
        ...invoiceData,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        lineItems: lineItems,
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        discount: calculateDiscount(),
        total: calculateTotal()
      }

      console.log('🧾 Creating invoice:', invoicePayload)
      
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoicePayload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create invoice')
      }

      const result = await response.json()
      console.log('✅ Invoice created successfully:', result.invoice)

      onInvoiceCreated?.(result.invoice)
      onOpenChange(false)
      
      // Reset form
      setSelectedClient(null)
      setInvoiceData({
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: 'USD',
        notes: '',
        terms: 'Net 30 days',
        tax: 0,
        discount: 0
      })
      setLineItems([{
        id: '1',
        description: 'Social Media Management Services',
        quantity: 1,
        rate: 2500,
        amount: 2500
      }])
      
      alert('Invoice created successfully!')
      
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert(`Error creating invoice: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendInvoice = async () => {
    if (!selectedClient) {
      alert('Please select a client before sending invoice')
      return
    }

    setIsLoading(true)
    try {
      const invoiceData = {
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        invoiceNumber: invoiceData.invoiceNumber,
        total: calculateTotal(),
        dueDate: invoiceData.dueDate,
        lineItems: lineItems
      }

      console.log('📧 Sending invoice email to:', selectedClient.email)
      
      const response = await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invoice email')
      }

      alert(`Invoice email sent successfully to ${selectedClient.email}!`)
      console.log('✅ Invoice email sent successfully')
      
    } catch (error) {
      console.error('Error sending invoice email:', error)
      alert(`Error sending invoice email: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadInvoice = async () => {
    if (!selectedClient) {
      alert('Please select a client before downloading invoice')
      return
    }

    setIsLoading(true)
    try {
      const invoiceData = {
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        clientCompany: selectedClient.company || selectedClient.name,
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        currency: invoiceData.currency,
        lineItems: lineItems,
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        discount: calculateDiscount(),
        total: calculateTotal(),
        notes: invoiceData.notes,
        terms: invoiceData.terms
      }

      console.log('📄 Generating PDF invoice for:', selectedClient.name)
      
      const response = await fetch('/api/invoices/download-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF invoice')
      }

      // Create a blob from the response and trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Invoice-${invoiceData.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log('✅ PDF invoice downloaded successfully')
      
    } catch (error) {
      console.error('Error downloading invoice PDF:', error)
      alert(`Error downloading invoice PDF: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Create and send professional invoices to your clients
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="details" className="h-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="details">Invoice Details</TabsTrigger>
              <TabsTrigger value="items">Line Items</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Invoice Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Invoice Number</Label>
                      <Input
                        value={invoiceData.invoiceNumber}
                        onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Issue Date</Label>
                        <Input
                          type="date"
                          value={invoiceData.issueDate}
                          onChange={(e) => setInvoiceData(prev => ({ ...prev, issueDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={invoiceData.dueDate}
                          onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Currency</Label>
                      <Select value={invoiceData.currency} onValueChange={(value) => setInvoiceData(prev => ({ ...prev, currency: value }))}>
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
                  </CardContent>
                </Card>

                {/* Client Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Bill To</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Select Client</Label>
                      <Select onValueChange={handleClientSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} - {client.company || client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedClient && (
                      <div className="p-3 bg-accent rounded-md">
                        <p className="font-medium">{selectedClient.name}</p>
                        {selectedClient.company && selectedClient.company !== selectedClient.name && (
                          <p className="text-sm text-muted-foreground">{selectedClient.company}</p>
                        )}
                        <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                        {selectedClient.phone && (
                          <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Additional Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Additional Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Payment Terms</Label>
                    <Select value={invoiceData.terms} onValueChange={(value) => setInvoiceData(prev => ({ ...prev, terms: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Due on receipt">Due on Receipt</SelectItem>
                        <SelectItem value="Net 7 days">Net 7 Days</SelectItem>
                        <SelectItem value="Net 15 days">Net 15 Days</SelectItem>
                        <SelectItem value="Net 30 days">Net 30 Days</SelectItem>
                        <SelectItem value="Net 60 days">Net 60 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Add any notes or additional information..."
                      value={invoiceData.notes}
                      onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Line Items</CardTitle>
                    <Button onClick={addLineItem} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-5">
                          {index === 0 && <Label className="text-xs">Description</Label>}
                          <Input
                            placeholder="Service or product description"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          {index === 0 && <Label className="text-xs">Quantity</Label>}
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="col-span-2">
                          {index === 0 && <Label className="text-xs">Rate</Label>}
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2">
                          {index === 0 && <Label className="text-xs">Amount</Label>}
                          <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                        <div className="col-span-1">
                          {lineItems.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  {/* Totals */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Tax (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={invoiceData.tax}
                          onChange={(e) => setInvoiceData(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label>Discount (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={invoiceData.discount}
                          onChange={(e) => setInvoiceData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="bg-accent p-4 rounded-md">
                      <div className="flex justify-between items-center mb-2">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(calculateSubtotal())}</span>
                      </div>
                      {invoiceData.tax > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span>Tax ({invoiceData.tax}%):</span>
                          <span>{formatCurrency(calculateTax())}</span>
                        </div>
                      )}
                      {invoiceData.discount > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span>Discount ({invoiceData.discount}%):</span>
                          <span>-{formatCurrency(calculateDiscount())}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(calculateTotal())}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedClient ? (
                    <div className="bg-white border rounded-lg p-6 space-y-6">
                      {/* Invoice Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-2xl font-bold">INVOICE</h1>
                          <p className="text-sm text-muted-foreground">#{invoiceData.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">SociallyHub</p>
                          <p className="text-sm text-muted-foreground">Social Media Management Platform</p>
                        </div>
                      </div>

                      {/* Client and Invoice Details */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-medium mb-2">Bill To:</h3>
                          <p className="font-medium">{selectedClient.name}</p>
                          {selectedClient.company && (
                            <p className="text-sm">{selectedClient.company}</p>
                          )}
                          <p className="text-sm">{selectedClient.email}</p>
                        </div>
                        <div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-sm">Issue Date:</span>
                              <span className="text-sm">{new Date(invoiceData.issueDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Due Date:</span>
                              <span className="text-sm">{new Date(invoiceData.dueDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Terms:</span>
                              <span className="text-sm">{invoiceData.terms}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Line Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Description</th>
                              <th className="text-right py-2">Qty</th>
                              <th className="text-right py-2">Rate</th>
                              <th className="text-right py-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item) => (
                              <tr key={item.id} className="border-b">
                                <td className="py-2">{item.description}</td>
                                <td className="text-right py-2">{item.quantity}</td>
                                <td className="text-right py-2">{formatCurrency(item.rate)}</td>
                                <td className="text-right py-2">{formatCurrency(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end">
                        <div className="w-64">
                          <div className="flex justify-between py-1">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(calculateSubtotal())}</span>
                          </div>
                          {invoiceData.tax > 0 && (
                            <div className="flex justify-between py-1">
                              <span>Tax ({invoiceData.tax}%):</span>
                              <span>{formatCurrency(calculateTax())}</span>
                            </div>
                          )}
                          {invoiceData.discount > 0 && (
                            <div className="flex justify-between py-1">
                              <span>Discount ({invoiceData.discount}%):</span>
                              <span>-{formatCurrency(calculateDiscount())}</span>
                            </div>
                          )}
                          <Separator className="my-2" />
                          <div className="flex justify-between py-1 font-bold text-lg">
                            <span>Total:</span>
                            <span>{formatCurrency(calculateTotal())}</span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {invoiceData.notes && (
                        <div className="pt-4">
                          <h4 className="font-medium mb-2">Notes:</h4>
                          <p className="text-sm">{invoiceData.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3" />
                      <p>Select a client to preview the invoice</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDownloadInvoice} disabled={!selectedClient}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handleSendInvoice} disabled={!selectedClient}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
            <Button onClick={handleCreateInvoice} disabled={isLoading || !selectedClient}>
              {isLoading ? (
                <Clock className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4 mr-2" />
              )}
              Create Invoice
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}