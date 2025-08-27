'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  DollarSign,
  CreditCard,
  Calendar,
  FileText,
  Download,
  Send,
  Edit,
  Eye,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Building,
  User,
  Mail
} from 'lucide-react'
import { 
  Client, 
  BillingCycle, 
  PaymentMethod 
} from '@/types/client'

interface ClientBillingIntegrationProps {
  client: Client
  onUpdateBilling?: (billingInfo: any) => void
  onGenerateInvoice?: (invoiceData: any) => void
}

export function ClientBillingIntegration({ 
  client, 
  onUpdateBilling, 
  onGenerateInvoice 
}: ClientBillingIntegrationProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)

  // Mock billing data
  const mockInvoices = [
    {
      id: 'INV-2024-001',
      date: new Date('2024-01-01'),
      dueDate: new Date('2024-01-31'),
      amount: 2500,
      status: 'Paid',
      description: 'Social Media Management - January 2024',
      paidDate: new Date('2024-01-28'),
      paymentMethod: 'Credit Card'
    },
    {
      id: 'INV-2023-012',
      date: new Date('2023-12-01'),
      dueDate: new Date('2023-12-31'),
      amount: 2500,
      status: 'Paid',
      description: 'Social Media Management - December 2023',
      paidDate: new Date('2023-12-29'),
      paymentMethod: 'Bank Transfer'
    },
    {
      id: 'INV-2024-002',
      date: new Date('2024-02-01'),
      dueDate: new Date('2024-02-29'),
      amount: 2500,
      status: 'Pending',
      description: 'Social Media Management - February 2024',
      paymentMethod: 'Credit Card'
    }
  ]

  const mockPayments = [
    {
      id: 'PAY-001',
      date: new Date('2024-01-28'),
      amount: 2500,
      method: 'Credit Card ending in 4532',
      status: 'Completed',
      invoiceId: 'INV-2024-001',
      transactionId: 'txn_1234567890'
    },
    {
      id: 'PAY-002',
      date: new Date('2023-12-29'),
      amount: 2500,
      method: 'Bank Transfer',
      status: 'Completed',
      invoiceId: 'INV-2023-012',
      transactionId: 'txn_0987654321'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const totalPaid = mockPayments
    .filter(p => p.status === 'Completed')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalOutstanding = mockInvoices
    .filter(i => i.status === 'Pending')
    .reduce((sum, i) => sum + i.amount, 0)

  const nextBillingDate = client.billingInfo?.nextBillingDate || new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Billing & Payments</h2>
          <p className="text-sm text-muted-foreground">
            Manage billing information and payment history for {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => onGenerateInvoice?.({})}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Billing Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              All time payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totalOutstanding)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextBillingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(client.billingInfo?.contractValue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {client.billingInfo?.paymentMethod === PaymentMethod.CREDIT_CARD ? '****4532' : 'Bank'}
            </div>
            <p className="text-xs text-muted-foreground">
              {client.billingInfo?.paymentMethod?.toLowerCase().replace('_', ' ') || 'Not set'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Billing Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Billing Information</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditing ? 'Save' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Billing Email</Label>
                    <Input 
                      value={client.billingInfo?.billingEmail || client.email}
                      readOnly={!isEditing}
                    />
                  </div>
                  <div>
                    <Label>Contract Value</Label>
                    <Input 
                      value={formatCurrency(client.billingInfo?.contractValue || 0)}
                      readOnly={!isEditing}
                    />
                  </div>
                  <div>
                    <Label>Billing Cycle</Label>
                    <Select value={client.billingInfo?.billingCycle} disabled={!isEditing}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={BillingCycle.MONTHLY}>Monthly</SelectItem>
                        <SelectItem value={BillingCycle.QUARTERLY}>Quarterly</SelectItem>
                        <SelectItem value={BillingCycle.ANNUAL}>Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payment Terms</Label>
                    <Select value={`${client.billingInfo?.paymentTerms || 30}`} disabled={!isEditing}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Net 15</SelectItem>
                        <SelectItem value="30">Net 30</SelectItem>
                        <SelectItem value="45">Net 45</SelectItem>
                        <SelectItem value="60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Billing Address</Label>
                  <Input 
                    placeholder="Street Address"
                    value={client.billingInfo?.billingAddress?.street || ''}
                    readOnly={!isEditing}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      placeholder="City"
                      value={client.billingInfo?.billingAddress?.city || ''}
                      readOnly={!isEditing}
                    />
                    <Input 
                      placeholder="State/Province"
                      value={client.billingInfo?.billingAddress?.state || ''}
                      readOnly={!isEditing}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      placeholder="ZIP/Postal Code"
                      value={client.billingInfo?.billingAddress?.zipCode || ''}
                      readOnly={!isEditing}
                    />
                    <Input 
                      placeholder="Country"
                      value={client.billingInfo?.billingAddress?.country || ''}
                      readOnly={!isEditing}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {client.billingInfo?.paymentMethod === PaymentMethod.CREDIT_CARD 
                        ? 'Credit Card ending in 4532' 
                        : client.billingInfo?.paymentMethod?.replace('_', ' ') || 'Not set'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {client.billingInfo?.paymentMethod === PaymentMethod.CREDIT_CARD 
                        ? 'Expires 12/25' 
                        : 'Primary payment method'
                      }
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>

                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Billing Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { date: '2024-01-28', action: 'Payment received', amount: 2500, status: 'success' },
                  { date: '2024-01-01', action: 'Invoice generated', amount: 2500, status: 'info' },
                  { date: '2023-12-29', action: 'Payment received', amount: 2500, status: 'success' },
                  { date: '2023-12-01', action: 'Invoice generated', amount: 2500, status: 'info' }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        activity.status === 'success' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {activity.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <FileText className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{activity.action}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(activity.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(activity.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Invoices</CardTitle>
                <Button size="sm" onClick={() => onGenerateInvoice?.({})}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{invoice.id}</div>
                        <div className="text-sm text-muted-foreground">
                          {invoice.description}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Due: {invoice.dueDate.toLocaleDateString()}
                          {invoice.paidDate && ` • Paid: ${invoice.paidDate.toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(invoice.amount)}</div>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3" />
                        </Button>
                        {invoice.status === 'Pending' && (
                          <Button variant="outline" size="sm">
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
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
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-100 rounded">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">{payment.method}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.date.toLocaleDateString()} • {payment.invoiceId}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Transaction ID: {payment.transactionId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium text-green-600">
                          {formatCurrency(payment.amount)}
                        </div>
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Billing Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Invoice Template</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Invoice</SelectItem>
                      <SelectItem value="detailed">Detailed Invoice</SelectItem>
                      <SelectItem value="minimal">Minimal Invoice</SelectItem>
                      <SelectItem value="branded">Branded Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Auto-billing</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="notify_only">Notify Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Late Payment Reminders</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { label: 'Invoice Generated', description: 'Notify when new invoice is created' },
                    { label: 'Payment Received', description: 'Notify when payment is processed' },
                    { label: 'Payment Failed', description: 'Notify when payment fails' },
                    { label: 'Upcoming Renewal', description: 'Notify before contract renewal' },
                    { label: 'Late Payment', description: 'Notify when payment is overdue' }
                  ].map((notification, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{notification.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {notification.description}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}