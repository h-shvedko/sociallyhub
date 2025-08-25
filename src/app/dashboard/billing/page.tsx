"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  CreditCard, 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  Zap, 
  Check, 
  Star,
  AlertCircle
} from "lucide-react"

const plans = [
  {
    name: "Free",
    price: 0,
    period: "month",
    features: [
      "3 social accounts",
      "10 scheduled posts",
      "Basic analytics",
      "Email support"
    ],
    limits: {
      accounts: 3,
      posts: 10,
      users: 1
    }
  },
  {
    name: "Pro",
    price: 29,
    period: "month",
    features: [
      "15 social accounts",
      "100 scheduled posts",
      "Advanced analytics",
      "Priority support",
      "Team collaboration",
      "Custom branding"
    ],
    limits: {
      accounts: 15,
      posts: 100,
      users: 5
    },
    popular: true
  },
  {
    name: "Business",
    price: 79,
    period: "month",
    features: [
      "50 social accounts",
      "Unlimited posts",
      "Advanced analytics",
      "24/7 phone support",
      "Advanced team features",
      "White-label solution",
      "API access"
    ],
    limits: {
      accounts: 50,
      posts: -1,
      users: 25
    }
  }
]

const mockInvoices = [
  {
    id: "INV-001",
    date: "2024-01-01",
    amount: 29.00,
    status: "paid",
    plan: "Pro Plan"
  },
  {
    id: "INV-002", 
    date: "2023-12-01",
    amount: 29.00,
    status: "paid",
    plan: "Pro Plan"
  },
  {
    id: "INV-003",
    date: "2023-11-01", 
    amount: 29.00,
    status: "paid",
    plan: "Pro Plan"
  }
]

export default function BillingPage() {
  const [currentPlan] = useState("Free")
  const [showPlans, setShowPlans] = useState(false)
  
  const currentPlanData = plans.find(plan => plan.name === currentPlan)
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, billing information, and usage.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Your current subscription and usage details
              </CardDescription>
            </div>
            <Badge variant={currentPlan === "Free" ? "secondary" : "default"}>
              {currentPlan} Plan
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{currentPlan} Plan</h3>
              <p className="text-muted-foreground">
                {currentPlan === "Free" 
                  ? "Get started with basic features" 
                  : `$${currentPlanData?.price}/${currentPlanData?.period}`
                }
              </p>
            </div>
            <div className="text-right">
              <Button 
                variant="outline"
                onClick={() => setShowPlans(true)}
              >
                {currentPlan === "Free" ? "Upgrade Plan" : "Change Plan"}
              </Button>
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="space-y-4">
            <h4 className="font-medium">Usage This Month</h4>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Social Accounts</span>
                  <span>2 / {currentPlanData?.limits.accounts}</span>
                </div>
                <Progress 
                  value={currentPlanData ? (2 / currentPlanData.limits.accounts) * 100 : 0} 
                  className="h-2" 
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Scheduled Posts</span>
                  <span>7 / {currentPlanData?.limits.posts === -1 ? "∞" : currentPlanData?.limits.posts}</span>
                </div>
                <Progress 
                  value={currentPlanData && currentPlanData.limits.posts !== -1 ? (7 / currentPlanData.limits.posts) * 100 : 5} 
                  className="h-2" 
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Team Members</span>
                  <span>1 / {currentPlanData?.limits.users}</span>
                </div>
                <Progress 
                  value={currentPlanData ? (1 / currentPlanData.limits.users) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </div>
          </div>

          {currentPlan === "Free" && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Upgrade to Pro to unlock unlimited posts and advanced features
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Information */}
      {currentPlan !== "Free" && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>
              Payment method and billing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="font-medium">•••• •••• •••• 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Update
                </Button>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Next billing date</p>
                  <p className="text-muted-foreground">February 1, 2024</p>
                </div>
                <div>
                  <p className="font-medium">Billing cycle</p>
                  <p className="text-muted-foreground">Monthly</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Download your invoices and view payment history
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {currentPlan === "Free" ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No billing history available</p>
              <p className="text-sm">Upgrade to a paid plan to see invoices here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mockInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.plan}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                      <Badge variant={invoice.status === "paid" ? "secondary" : "destructive"}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Dialog */}
      <Dialog open={showPlans} onOpenChange={setShowPlans}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose Your Plan</DialogTitle>
            <DialogDescription>
              Select the plan that best fits your needs
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-6 py-4">
            {plans.map((plan) => (
              <Card key={plan.name} className={`relative ${plan.popular ? "ring-2 ring-primary" : ""}`}>
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.name === currentPlan ? "secondary" : "default"}
                    disabled={plan.name === currentPlan}
                  >
                    {plan.name === currentPlan ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}