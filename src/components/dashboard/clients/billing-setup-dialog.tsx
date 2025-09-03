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
import { DollarSign, CreditCard, Calendar, Settings } from 'lucide-react'
import { Client } from '@/types/client'

interface BillingSetupDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onBillingSetup?: (billingData: any) => void
}

export function BillingSetupDialog({ client, open, onOpenChange, onBillingSetup }: BillingSetupDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [billingData, setBillingData] = useState({
    contractValue: '',
    currency: 'USD',
    billingCycle: 'monthly',
    startDate: '',
    endDate: '',
    paymentTerms: '30',
    services: '',
    notes: ''
  })

  const handleSave = async () => {
    if (!client) return
    
    setIsLoading(true)
    try {
      console.log('💰 Setting up billing for client:', client.name, billingData)
      
      // TODO: Make API call to save billing information
      // const response = await fetch(`/api/clients/${client.id}/billing`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(billingData)
      // })
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      onBillingSetup?.(billingData)
      onOpenChange(false)
      
      // Reset form
      setBillingData({
        contractValue: '',
        currency: 'USD',
        billingCycle: 'monthly',
        startDate: '',
        endDate: '',
        paymentTerms: '30',
        services: '',
        notes: ''
      })
    } catch (error) {
      console.error('Error setting up billing:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setBillingData(prev => ({ ...prev, [field]: value }))
  }

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Set Up Billing for {client.name}
          </DialogTitle>
          <DialogDescription>
            Configure billing information and contract details for this client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contract Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-4 w-4" />
                Contract Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contractValue">Contract Value</Label>
                  <Input
                    id="contractValue"
                    type="number"
                    placeholder="10000"
                    value={billingData.contractValue}
                    onChange={(e) => handleInputChange('contractValue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={billingData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billingCycle">Billing Cycle</Label>
                  <Select value={billingData.billingCycle} onValueChange={(value) => handleInputChange('billingCycle', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi-annually">Semi-Annually</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                      <SelectItem value="one-time">One-Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentTerms">Payment Terms (Days)</Label>
                  <Select value={billingData.paymentTerms} onValueChange={(value) => handleInputChange('paymentTerms', value)}>
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
            </CardContent>
          </Card>

          {/* Contract Period */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-4 w-4" />
                Contract Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={billingData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={billingData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-4 w-4" />
                Services & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="services">Services Provided</Label>
                <Textarea
                  id="services"
                  placeholder="Describe the services included in this contract..."
                  value={billingData.services}
                  onChange={(e) => handleInputChange('services', e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional billing notes or special terms..."
                  value={billingData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {billingData.contractValue && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Billing Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contract Value:</span>
                  <Badge variant="secondary" className="text-lg font-semibold">
                    {billingData.contractValue} {billingData.currency}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Billing Cycle:</span>
                  <span className="font-medium">{billingData.billingCycle}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Payment Terms:</span>
                  <span className="font-medium">Net {billingData.paymentTerms} days</span>
                </div>
              </CardContent>
            </Card>
          )}
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
            onClick={handleSave}
            disabled={isLoading || !billingData.contractValue}
          >
            {isLoading ? 'Setting up...' : 'Set Up Billing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}