'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { InvoiceCreationDialog } from './invoice-creation-dialog'
import { PaymentSettingsDialog } from './payment-settings-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DollarSign,
  CreditCard,
  Receipt,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Plus,
  Settings,
  Wallet,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Send,
  MoreVertical,
  Edit,
  CheckCircle
} from 'lucide-react'

interface BillingOverviewProps {
  clients?: any[]
}

export function BillingOverview({ clients = [] }: BillingOverviewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [billingData, setBillingData] = useState<any>(null)
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [showPaymentSettings, setShowPaymentSettings] = useState(false)

  useEffect(() => {
    fetchBillingData()
  }, [clients])

  const fetchBillingData = async () => {
    setIsLoading(true)
    try {
      // Calculate billing statistics from clients with billing info
      const clientsWithBilling = clients.filter(client => client.billingInfo)
      const totalRevenue = clientsWithBilling.reduce((sum, client) => {
        return sum + (client.billingInfo?.contractValue || 0)
      }, 0)

      const monthlyRecurring = clientsWithBilling.reduce((sum, client) => {
        if (client.billingInfo?.billingCycle === 'monthly') {
          return sum + (client.billingInfo?.contractValue || 0)
        }
        if (client.billingInfo?.billingCycle === 'quarterly') {
          return sum + (client.billingInfo?.contractValue || 0) / 3
        }
        if (client.billingInfo?.billingCycle === 'yearly') {
          return sum + (client.billingInfo?.contractValue || 0) / 12
        }
        return sum
      }, 0)

      setBillingData({
        totalRevenue,
        monthlyRecurring,
        activeClients: clientsWithBilling.length,
        pendingInvoices: 3,
        overdueAmount: 2500,
        nextBillingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revenueGrowth: 12.5,
        collectionRate: 94.2
      })

      // Fetch real invoices from API
      try {
        const response = await fetch('/api/invoices?limit=10')
        if (response.ok) {
          const data = await response.json()
          const invoices = data.invoices.map((invoice: any) => ({
            id: invoice.id, // Keep the actual database ID
            invoiceNumber: invoice.invoiceNumber, // Keep this for display
            clientName: invoice.clientName,
            clientEmail: invoice.clientEmail || '',
            amount: invoice.amount,
            currency: invoice.currency,
            status: invoice.status,
            dueDate: invoice.dueDate,
            issuedDate: invoice.issueDate || invoice.createdAt,
            paymentMethod: 'Pending' // Default since we don't track payment methods yet
          }))
          setRecentInvoices(invoices)
        } else {
          console.error('Failed to fetch invoices')
          setRecentInvoices([]) // Set empty array if fetch fails
        }
      } catch (error) {
        console.error('Error fetching invoices:', error)
        setRecentInvoices([])
      }

      // Mock payment methods
      setPaymentMethods([
        {
          id: 'stripe',
          name: 'Stripe',
          type: 'Credit Cards & ACH',
          status: 'connected',
          fees: '2.9% + $0.30',
          lastTransaction: '2025-09-03'
        },
        {
          id: 'paypal',
          name: 'PayPal',
          type: 'PayPal & Credit Cards',
          status: 'connected',
          fees: '3.4% + $0.30',
          lastTransaction: '2025-09-01'
        },
        {
          id: 'bank',
          name: 'Bank Transfer',
          type: 'ACH & Wire',
          status: 'configured',
          fees: 'Flat $5.00',
          lastTransaction: '2025-08-28'
        }
      ])

    } catch (error) {
      console.error('Error fetching billing data:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
        return <CheckCircle2 className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const handleCreateInvoice = () => {
    console.log('🧾 Opening invoice creation dialog')
    setShowInvoiceDialog(true)
  }

  const handleInvoiceCreated = (invoiceData: any) => {
    console.log('📄 Invoice created:', invoiceData)
    
    // Use the invoice data returned from the API (already properly formatted)
    const newInvoice = {
      id: invoiceData.id, // Use actual database ID for API calls
      invoiceNumber: invoiceData.invoiceNumber, // Use this for display
      clientName: invoiceData.clientName,
      amount: invoiceData.amount,
      currency: invoiceData.currency,
      status: invoiceData.status,
      dueDate: invoiceData.dueDate,
      issuedDate: invoiceData.issueDate,
      paymentMethod: 'Pending',
      clientEmail: invoiceData.clientEmail || ''
    }
    
    // Add new invoice to the beginning of the list immediately
    setRecentInvoices(prev => {
      const updated = [newInvoice, ...prev]
      console.log('📄 Updated invoice list with new invoice, total:', updated.length)
      return updated
    })
    
    // Update billing data without fetching from API to avoid state changes
    setBillingData(prev => prev ? {
      ...prev,
      pendingInvoices: (prev.pendingInvoices || 0) + 1
    } : null)
    
    // Don't close the dialog automatically - let user choose when to close
    console.log('📄 Invoice creation handled, modal should remain open')
  }

  const handleDownloadInvoice = async (invoice: any) => {
    console.log('📄 Downloading invoice:', invoice.invoiceNumber)
    setIsLoading(true)
    try {
      // Dynamic import for client-side only
      const { jsPDF } = await import('jspdf')
      
      // Create new PDF document with proper configuration
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      // Set document properties
      doc.setProperties({
        title: `Invoice ${invoice.invoiceNumber}`,
        author: 'SociallyHub',
        subject: `Invoice for ${invoice.clientName}`,
        creator: 'SociallyHub Invoice System'
      })

      // Helper function to safely add text
      const safeText = (text: string, x: number, y: number, maxWidth?: number) => {
        if (!text) return 5
        const cleanText = String(text).replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
        if (maxWidth) {
          const lines = doc.splitTextToSize(cleanText, maxWidth)
          doc.text(lines, x, y)
          return Array.isArray(lines) ? lines.length * 5 : 5
        } else {
          doc.text(cleanText, x, y)
          return 5
        }
      }

      // Company Header
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      safeText('INVOICE', 20, 30)
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      safeText('SociallyHub', 150, 20)
      safeText('Social Media Management Platform', 150, 28)
      safeText('Email: billing@sociallyhub.com', 150, 36)
      safeText('Phone: (555) 123-4567', 150, 44)

      // Invoice Details
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      safeText(`Invoice #${invoice.invoiceNumber}`, 20, 50)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      safeText(`Issue Date: ${new Date(invoice.issuedDate).toLocaleDateString()}`, 20, 60)
      safeText(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 68)
      safeText(`Status: ${invoice.status.toUpperCase()}`, 20, 76)

      // Client Information
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      safeText('Bill To:', 20, 90)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      let yPos = 98
      yPos += safeText(invoice.clientName || '', 20, yPos)
      if (invoice.clientEmail) {
        yPos += safeText(invoice.clientEmail || '', 20, yPos)
      }

      // Line Items Table Header
      yPos += 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      safeText('Description', 20, yPos)
      safeText('Qty', 120, yPos)
      safeText('Rate', 140, yPos)
      safeText('Amount', 170, yPos)
      
      // Table line
      yPos += 5
      doc.line(20, yPos, 190, yPos)
      yPos += 8

      // Line Items - for now use default service
      doc.setFont('helvetica', 'normal')
      safeText('Social Media Management Services', 20, yPos, 90)
      safeText('1', 120, yPos)
      safeText(formatCurrency(invoice.amount, invoice.currency), 140, yPos)
      safeText(formatCurrency(invoice.amount, invoice.currency), 170, yPos)
      yPos += 8

      // Totals section
      yPos += 10
      doc.line(120, yPos, 190, yPos)
      yPos += 8

      doc.setFont('helvetica', 'bold')
      safeText('TOTAL:', 120, yPos)
      safeText(formatCurrency(invoice.amount, invoice.currency), 170, yPos)

      // Payment Terms
      yPos += 20
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      safeText('Payment Terms: Net 30 days', 20, yPos)
      
      // Status footer
      if (invoice.status === 'paid') {
        yPos += 10
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 128, 0)
        safeText('PAID', 85, yPos)
        doc.setTextColor(0, 0, 0)
      }

      // Generate PDF blob and create download
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Invoice-${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      console.log('✅ Invoice PDF downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`Error downloading invoice: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    console.log(`📄 Updating invoice ${invoiceId} status to ${newStatus}`)
    console.log('📄 Full invoice data:', recentInvoices.find(inv => inv.id === invoiceId))
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update invoice status')
      }

      // Update local state
      setRecentInvoices(prev => prev.map(inv => 
        inv.id === invoiceId ? { ...inv, status: newStatus } : inv
      ))
      
      // Update billing data based on status change
      if (newStatus === 'paid') {
        setBillingData(prev => prev ? {
          ...prev,
          pendingInvoices: Math.max(0, (prev.pendingInvoices || 0) - 1)
        } : null)
      }
      
      console.log(`✅ Invoice ${invoiceId} status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating invoice status:', error)
      alert(`Error updating invoice status: ${error.message}`)
    }
  }

  const handlePaymentSettings = () => {
    console.log('⚙️ Opening payment settings')
    setShowPaymentSettings(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(billingData?.totalRevenue || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                    +{billingData?.revenueGrowth || 0}% from last month
                  </span>
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Recurring</p>
                <p className="text-2xl font-bold">{formatCurrency(billingData?.monthlyRecurring || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {billingData?.activeClients || 0} active clients
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Invoices</p>
                <p className="text-2xl font-bold">{billingData?.pendingInvoices || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Next due: {billingData?.nextBillingDate?.toLocaleDateString() || 'N/A'}
                </p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Receipt className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Collection Rate</p>
                <p className="text-2xl font-bold">{billingData?.collectionRate || 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(billingData?.overdueAmount || 0)} overdue
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quick Actions</CardTitle>
            <Button variant="outline" size="sm" onClick={handlePaymentSettings}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCreateInvoice} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Payment Link
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Payment
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Recent Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Invoices</CardTitle>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentInvoices.map((invoice) => {
                  console.log('📄 Rendering invoice:', invoice.id, invoice.invoiceNumber)
                  return (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                        <Receipt className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <Badge className={getStatusColor(invoice.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(invoice.status)}
                              {invoice.status.toUpperCase()}
                            </div>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          Issued: {new Date(invoice.issuedDate).toLocaleDateString()} • 
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-3">
                        <p className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.status === 'paid' ? 'Paid' : invoice.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </p>
                      </div>
                      
                      {/* Action buttons based on status */}
                      <div className="flex items-center gap-1">
                        {invoice.status === 'draft' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateInvoiceStatus(invoice.id, 'pending')}
                              title="Send Invoice"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => console.log('Edit invoice:', invoice.id)}
                              title="Edit Invoice"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {invoice.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateInvoiceStatus(invoice.id, 'paid')}
                            title="Mark as Paid"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {invoice.status === 'overdue' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700"
                              onClick={() => console.log('Send reminder:', invoice.id)}
                              title="Send Reminder"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateInvoiceStatus(invoice.id, 'paid')}
                              title="Mark as Paid"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {/* More options dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleUpdateInvoiceStatus(invoice.id, 'pending')}>
                                <Send className="h-4 w-4 mr-2" />
                                Send Invoice
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'pending' && (
                              <DropdownMenuItem onClick={() => handleUpdateInvoiceStatus(invoice.id, 'paid')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'paid' && (
                              <DropdownMenuItem onClick={() => handleUpdateInvoiceStatus(invoice.id, 'pending')}>
                                <Clock className="h-4 w-4 mr-2" />
                                Mark as Unpaid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => console.log('View invoice:', invoice.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {invoice.status !== 'paid' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => console.log('Send reminder:', invoice.id)}>
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Send Reminder
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => console.log('Edit invoice:', invoice.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => console.log('Delete invoice:', invoice.id)}
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Delete Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Processors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{method.name}</p>
                          <Badge className={method.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {method.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{method.type}</p>
                        <p className="text-xs text-muted-foreground">
                          Fees: {method.fees} • Last: {new Date(method.lastTransaction).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Wallet className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm font-medium mb-2">Add Payment Method</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Connect additional payment processors to expand payment options
                  </p>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Processor
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">This Month</span>
                    <span className="font-medium">{formatCurrency(billingData?.monthlyRecurring * 1.2 || 0)}</span>
                  </div>
                  <Progress value={75} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Month</span>
                    <span className="font-medium">{formatCurrency(billingData?.monthlyRecurring || 0)}</span>
                  </div>
                  <Progress value={60} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">2 Months Ago</span>
                    <span className="font-medium">{formatCurrency(billingData?.monthlyRecurring * 0.8 || 0)}</span>
                  </div>
                  <Progress value={48} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Paid</span>
                    </div>
                    <span className="font-medium">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="font-medium">10%</span>
                  </div>
                  <Progress value={10} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Overdue</span>
                    </div>
                    <span className="font-medium">5%</span>
                  </div>
                  <Progress value={5} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice Creation Dialog */}
      <InvoiceCreationDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        clients={clients}
        onInvoiceCreated={handleInvoiceCreated}
      />

      {/* Payment Settings Dialog */}
      <PaymentSettingsDialog
        open={showPaymentSettings}
        onOpenChange={setShowPaymentSettings}
      />
    </div>
  )
}