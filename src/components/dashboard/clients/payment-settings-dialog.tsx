'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CreditCard,
  Settings,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Link,
  Unlink,
  DollarSign,
  Percent,
  Calendar,
  Clock,
  Shield,
  Zap
} from 'lucide-react'

interface PaymentSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentSettingsDialog({ open, onOpenChange }: PaymentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('stripe')
  const [isLoading, setIsLoading] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  
  const [stripeConfig, setStripeConfig] = useState({
    enabled: true,
    publishableKey: 'pk_test_51H...',
    secretKey: 'sk_test_51H...',
    webhookSecret: 'whsec_...',
    connected: true,
    testMode: true
  })
  
  const [paypalConfig, setPaypalConfig] = useState({
    enabled: false,
    clientId: '',
    clientSecret: '',
    webhookId: '',
    connected: false,
    testMode: true
  })
  
  const [bankConfig, setBankConfig] = useState({
    enabled: true,
    routingNumber: '123456789',
    accountName: 'SociallyHub Business',
    achEnabled: true,
    wireEnabled: false,
    connected: true
  })

  const handleStripeConnect = async () => {
    setIsLoading(true)
    try {
      // Simulate Stripe connection
      await new Promise(resolve => setTimeout(resolve, 1500))
      setStripeConfig(prev => ({ ...prev, connected: true }))
      console.log('✅ Stripe connected successfully')
      alert('Stripe connected successfully! You can now accept credit card payments.')
    } catch (error) {
      console.error('❌ Stripe connection failed:', error)
      alert('Failed to connect to Stripe. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePayPalConnect = async () => {
    setIsLoading(true)
    try {
      // Simulate PayPal connection
      await new Promise(resolve => setTimeout(resolve, 1500))
      setPaypalConfig(prev => ({ ...prev, connected: true }))
      console.log('✅ PayPal connected successfully')
      alert('PayPal connected successfully! You can now accept PayPal payments.')
    } catch (error) {
      console.error('❌ PayPal connection failed:', error)
      alert('Failed to connect to PayPal. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBankSetup = async () => {
    setIsLoading(true)
    try {
      // Simulate bank account setup
      await new Promise(resolve => setTimeout(resolve, 1000))
      setBankConfig(prev => ({ ...prev, connected: true }))
      console.log('✅ Bank account configured successfully')
      alert('Bank account configured successfully! You can now accept ACH transfers.')
    } catch (error) {
      console.error('❌ Bank setup failed:', error)
      alert('Failed to configure bank account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = (provider: string) => {
    const confirmDisconnect = confirm(`Are you sure you want to disconnect ${provider}? This will disable ${provider} payments for all invoices.`)
    if (confirmDisconnect) {
      switch (provider) {
        case 'stripe':
          setStripeConfig(prev => ({ ...prev, connected: false }))
          break
        case 'paypal':
          setPaypalConfig(prev => ({ ...prev, connected: false }))
          break
        case 'bank':
          setBankConfig(prev => ({ ...prev, connected: false }))
          break
      }
      alert(`${provider} disconnected successfully.`)
    }
  }

  const getStatusBadge = (connected: boolean, enabled: boolean) => {
    if (connected && enabled) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      )
    } else if (!connected && enabled) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Setup Required
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Disabled
        </Badge>
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Payment Processor Settings
          </DialogTitle>
          <DialogDescription>
            Configure payment processors to accept payments for your invoices
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stripe" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe
                {getStatusBadge(stripeConfig.connected, stripeConfig.enabled)}
              </TabsTrigger>
              <TabsTrigger value="paypal" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                PayPal
                {getStatusBadge(paypalConfig.connected, paypalConfig.enabled)}
              </TabsTrigger>
              <TabsTrigger value="bank" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Bank Transfer
                {getStatusBadge(bankConfig.connected, bankConfig.enabled)}
              </TabsTrigger>
            </TabsList>

            {/* Stripe Configuration */}
            <TabsContent value="stripe" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      Stripe Configuration
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={stripeConfig.enabled}
                        onCheckedChange={(checked) => 
                          setStripeConfig(prev => ({ ...prev, enabled: checked }))
                        }
                      />
                      <Label>Enabled</Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Publishable Key</Label>
                      <Input
                        value={stripeConfig.publishableKey}
                        onChange={(e) => 
                          setStripeConfig(prev => ({ ...prev, publishableKey: e.target.value }))
                        }
                        placeholder="pk_test_..."
                      />
                    </div>
                    <div>
                      <Label>Secret Key</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={stripeConfig.secretKey}
                          onChange={(e) => 
                            setStripeConfig(prev => ({ ...prev, secretKey: e.target.value }))
                          }
                          placeholder="sk_test_..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Webhook Endpoint Secret</Label>
                    <Input
                      value={stripeConfig.webhookSecret}
                      onChange={(e) => 
                        setStripeConfig(prev => ({ ...prev, webhookSecret: e.target.value }))
                      }
                      placeholder="whsec_..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Webhook URL: https://yourapp.com/api/webhooks/stripe
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Processing Fees</span>
                    </div>
                    <span className="text-sm">2.9% + $0.30 per transaction</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={stripeConfig.testMode}
                        onCheckedChange={(checked) => 
                          setStripeConfig(prev => ({ ...prev, testMode: checked }))
                        }
                      />
                      <Label>Test Mode</Label>
                    </div>
                    <div className="flex gap-2">
                      {stripeConfig.connected ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect('stripe')}
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          onClick={handleStripeConnect}
                          disabled={isLoading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Link className="h-4 w-4 mr-2" />
                          {isLoading ? 'Connecting...' : 'Connect Stripe'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PayPal Configuration */}
            <TabsContent value="paypal" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                      PayPal Configuration
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={paypalConfig.enabled}
                        onCheckedChange={(checked) => 
                          setPaypalConfig(prev => ({ ...prev, enabled: checked }))
                        }
                      />
                      <Label>Enabled</Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Client ID</Label>
                      <Input
                        value={paypalConfig.clientId}
                        onChange={(e) => 
                          setPaypalConfig(prev => ({ ...prev, clientId: e.target.value }))
                        }
                        placeholder="AeA1QIZXiflr8..."
                      />
                    </div>
                    <div>
                      <Label>Client Secret</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={paypalConfig.clientSecret}
                          onChange={(e) => 
                            setPaypalConfig(prev => ({ ...prev, clientSecret: e.target.value }))
                          }
                          placeholder="EClusMEUk4e16..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Webhook ID</Label>
                    <Input
                      value={paypalConfig.webhookId}
                      onChange={(e) => 
                        setPaypalConfig(prev => ({ ...prev, webhookId: e.target.value }))
                      }
                      placeholder="5WH12345..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Webhook URL: https://yourapp.com/api/webhooks/paypal
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">Processing Fees</span>
                    </div>
                    <span className="text-sm">3.4% + $0.30 per transaction</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={paypalConfig.testMode}
                        onCheckedChange={(checked) => 
                          setPaypalConfig(prev => ({ ...prev, testMode: checked }))
                        }
                      />
                      <Label>Sandbox Mode</Label>
                    </div>
                    <div className="flex gap-2">
                      {paypalConfig.connected ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect('paypal')}
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          onClick={handlePayPalConnect}
                          disabled={isLoading}
                          className="bg-yellow-600 hover:bg-yellow-700"
                        >
                          <Link className="h-4 w-4 mr-2" />
                          {isLoading ? 'Connecting...' : 'Connect PayPal'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bank Transfer Configuration */}
            <TabsContent value="bank" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      Bank Transfer Configuration
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bankConfig.enabled}
                        onCheckedChange={(checked) => 
                          setBankConfig(prev => ({ ...prev, enabled: checked }))
                        }
                      />
                      <Label>Enabled</Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Account Name</Label>
                      <Input
                        value={bankConfig.accountName}
                        onChange={(e) => 
                          setBankConfig(prev => ({ ...prev, accountName: e.target.value }))
                        }
                        placeholder="SociallyHub Business"
                      />
                    </div>
                    <div>
                      <Label>Routing Number</Label>
                      <Input
                        value={bankConfig.routingNumber}
                        onChange={(e) => 
                          setBankConfig(prev => ({ ...prev, routingNumber: e.target.value }))
                        }
                        placeholder="123456789"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">ACH Transfers</p>
                          <p className="text-xs text-muted-foreground">3-5 business days</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">$5.00 flat fee</span>
                        <Switch
                          checked={bankConfig.achEnabled}
                          onCheckedChange={(checked) => 
                            setBankConfig(prev => ({ ...prev, achEnabled: checked }))
                          }
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">Wire Transfers</p>
                          <p className="text-xs text-muted-foreground">Same day</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">$25.00 flat fee</span>
                        <Switch
                          checked={bankConfig.wireEnabled}
                          onCheckedChange={(checked) => 
                            setBankConfig(prev => ({ ...prev, wireEnabled: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Bank transfers require manual verification and processing
                    </p>
                    <Button
                      onClick={handleBankSetup}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {isLoading ? 'Configuring...' : 'Configure Bank Transfer'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button 
            onClick={() => {
              console.log('💾 Saving payment settings')
              alert('Payment settings saved successfully!')
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}