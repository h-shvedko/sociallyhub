'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { InvoiceCreationDialog } from './invoice-creation-dialog'
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
  Zap
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

  useEffect(() => {
    fetchBillingData()
  }, [clients])

  const fetchBillingData = async () => {
    setIsLoading(true)
    try {
      // Simulate fetching billing data
      await new Promise(resolve => setTimeout(resolve, 1000))
      
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

      // Mock recent invoices
      setRecentInvoices([
        {
          id: 'INV-001',
          clientName: 'Acme Corporation',
          amount: 5000,
          currency: 'USD',
          status: 'paid',
          dueDate: '2025-09-15',
          issuedDate: '2025-08-15',
          paymentMethod: 'Credit Card'
        },
        {
          id: 'INV-002',
          clientName: 'TechStart Inc.',
          amount: 3500,
          currency: 'USD',
          status: 'pending',
          dueDate: '2025-09-20',
          issuedDate: '2025-08-20',
          paymentMethod: 'Bank Transfer'
        },
        {
          id: 'INV-003',
          clientName: 'Global Retail Co.',
          amount: 2000,
          currency: 'USD',
          status: 'overdue',
          dueDate: '2025-08-30',
          issuedDate: '2025-07-30',
          paymentMethod: 'ACH'
        },
        {
          id: 'INV-004',
          clientName: 'Healthcare Plus',
          amount: 4200,
          currency: 'USD',
          status: 'paid',
          dueDate: '2025-09-10',
          issuedDate: '2025-08-10',
          paymentMethod: 'Credit Card'
        }
      ])

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
    // Add the new invoice to the recent invoices list
    const newInvoice = {
      id: invoiceData.invoiceNumber || `INV-${Date.now()}`,
      clientName: invoiceData.clientName,
      amount: invoiceData.subtotal + (invoiceData.tax || 0) - (invoiceData.discount || 0),
      currency: invoiceData.currency,
      status: 'draft',
      dueDate: invoiceData.dueDate,
      issuedDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Pending'
    }
    
    setRecentInvoices(prev => [newInvoice, ...prev])
    setShowInvoiceDialog(false)
    
    // Update billing data
    fetchBillingData()
  }

  const handleDownloadInvoice = (invoice: any) => {
    console.log('📄 Downloading invoice:', invoice.id)
    // TODO: Implement invoice download
    alert(`Downloading invoice ${invoice.id} for ${invoice.clientName}. This would generate a PDF invoice with company branding.`)
  }

  const handlePaymentSettings = () => {
    console.log('⚙️ Opening payment settings')
    // TODO: Implement payment settings modal
    alert('Payment processor settings would open here. This would allow configuring Stripe, PayPal, bank accounts, and other payment methods.')
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
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                        <Receipt className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{invoice.id}</p>
                          <Badge className={getStatusColor(invoice.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(invoice.status)}
                              {invoice.status.toUpperCase()}
                            </div>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()} • 
                          {invoice.paymentMethod}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
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
    </div>
  )
}