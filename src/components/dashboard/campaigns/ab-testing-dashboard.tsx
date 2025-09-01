'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Split, 
  Plus, 
  Play, 
  Pause, 
  Trophy, 
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Calendar
} from 'lucide-react'
import { Campaign } from '@/types/campaign'

interface ABTestingDashboardProps {
  workspaceId: string
  campaigns: Campaign[]
}

export function ABTestingDashboard({ workspaceId, campaigns }: ABTestingDashboardProps) {
  const [activeTests] = useState([])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-100 text-green-800'
      case 'COMPLETED': return 'bg-blue-100 text-blue-800'
      case 'SETUP': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">A/B Testing Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Compare different versions of your campaigns to optimize performance
          </p>
        </div>
        <Button onClick={() => console.log('Create A/B Test clicked')} disabled>
          <Plus className="h-4 w-4 mr-2" />
          Create A/B Test
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
            <Split className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeTests.filter(test => test.status === 'RUNNING').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeTests.length} total tests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tests</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeTests.filter(test => test.status === 'COMPLETED').length}
            </div>
            <p className="text-xs text-muted-foreground">
              With statistical significance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">-</div>
            <p className="text-xs text-muted-foreground">
              No data available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Level</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              No data available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Tests */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Active & Recent Tests</h3>
        
        {activeTests.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Split className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No A/B tests found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first A/B test to compare campaign variations
                </p>
                <Button onClick={() => console.log('Create A/B Test clicked')} disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create A/B Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeTests.map((test) => (
              <Card key={test.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{test.testName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Campaign: {test.campaignName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(test.status)}>
                        {test.status.toLowerCase()}
                      </Badge>
                      {test.status === 'RUNNING' && (
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4 mr-2" />
                          Stop Test
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Test Duration */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(test.startDate).toLocaleDateString()} - {new Date(test.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      <span>{test.confidenceLevel}% confidence</span>
                    </div>
                  </div>

                  {/* Variants Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {test.variants.map((variant, index) => (
                      <div 
                        key={variant.id} 
                        className={`p-4 border rounded-lg ${
                          test.winner === variant.id ? 'border-green-500 bg-green-50' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{variant.name}</h5>
                          {test.winner === variant.id && (
                            <Badge className="bg-green-100 text-green-800">
                              <Trophy className="h-3 w-3 mr-1" />
                              Winner
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Traffic Split</span>
                            <span>{variant.traffic}%</span>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span>Conversions</span>
                            <span>{variant.conversions}</span>
                          </div>
                          
                          <div className="flex justify-between text-sm font-medium">
                            <span>Conversion Rate</span>
                            <span className={test.winner === variant.id ? 'text-green-600' : ''}>
                              {variant.conversionRate}%
                            </span>
                          </div>
                          
                          <Progress value={variant.conversionRate * 10} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Test Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      {test.status === 'RUNNING' ? (
                        <Badge variant="secondary" className="text-xs">
                          <Play className="h-3 w-3 mr-1" />
                          Test in progress
                        </Badge>
                      ) : test.status === 'COMPLETED' && test.winner ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <Trophy className="h-3 w-3 mr-1" />
                          Winner determined
                        </Badge>
                      ) : null}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {test.status === 'COMPLETED' && test.winner && (
                        <Button size="sm">
                          Apply Winner
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* A/B Testing Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>A/B Testing Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h5 className="font-medium">Test One Variable at a Time</h5>
              <p className="text-muted-foreground">
                To get clear results, only change one element between variants (headline, image, CTA, etc.)
              </p>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium">Run Tests for Statistical Significance</h5>
              <p className="text-muted-foreground">
                Ensure your test reaches at least 95% confidence level before making decisions
              </p>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium">Test with Sufficient Sample Size</h5>
              <p className="text-muted-foreground">
                Larger sample sizes provide more reliable results and reduce chance of false positives
              </p>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium">Consider External Factors</h5>
              <p className="text-muted-foreground">
                Account for seasonality, holidays, and market events that might affect results
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}