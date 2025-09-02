'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  BarChart3, 
  Calendar, 
  Target, 
  TrendingUp, 
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface ABTestDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  test: any
}

export function ABTestDetailsDialog({ open, onOpenChange, test }: ABTestDetailsDialogProps) {
  if (!test) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-100 text-green-800'
      case 'COMPLETED': return 'bg-blue-100 text-blue-800'
      case 'STOPPED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-green-600'
    if (confidence >= 90) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>A/B Test Details</DialogTitle>
          <DialogDescription>
            View comprehensive results and analytics for this A/B test
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-1">
            {/* Test Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{test.testName}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {test.description}
                    </p>
                  </div>
                  <Badge className={getStatusColor(test.status)}>
                    {test.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Campaign</p>
                    <p className="font-medium">{test.campaignName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(test.startDate).toLocaleDateString()} - {new Date(test.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Confidence Level</p>
                    <p className={`font-medium flex items-center gap-1 ${getConfidenceColor(test.confidenceLevel)}`}>
                      <Target className="h-4 w-4" />
                      {test.confidenceLevel}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Executions</p>
                    <p className="font-medium flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {test.executions || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variants Details */}
            <Tabs defaultValue="comparison" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Comparison Tab */}
              <TabsContent value="comparison" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {test.variants?.map((variant: any) => (
                    <Card key={variant.id} className={variant.id === test.winner ? 'ring-2 ring-green-500' : ''}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{variant.name}</CardTitle>
                          {variant.id === test.winner && (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Winner
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Traffic Split</span>
                            <span>{variant.traffic}%</span>
                          </div>
                          <Progress value={variant.traffic} className="h-2" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Views</span>
                            <span>{variant.views || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Clicks</span>
                            <span>{variant.clicks || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Conversions</span>
                            <span>{variant.conversions || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm font-medium">
                            <span>Conversion Rate</span>
                            <span className={variant.id === test.winner ? 'text-green-600' : ''}>
                              {variant.conversionRate || 0}%
                            </span>
                          </div>
                        </div>

                        {variant.lift && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between text-sm">
                              <span>Lift vs Control</span>
                              <span className={`font-medium ${variant.lift > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <TrendingUp className="h-3 w-3 inline mr-1" />
                                {variant.lift > 0 ? '+' : ''}{variant.lift}%
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4">
                {test.variants?.map((variant: any) => (
                  <Card key={variant.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{variant.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="whitespace-pre-wrap">{variant.content}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium mb-2">Statistical Significance</h5>
                        <div className="flex items-center gap-2">
                          {test.confidenceLevel >= 95 ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : test.confidenceLevel >= 90 ? (
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className={getConfidenceColor(test.confidenceLevel)}>
                            {test.confidenceLevel}% confidence level
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {test.confidenceLevel >= 95 
                            ? 'Results are statistically significant'
                            : 'More data needed for statistical significance'}
                        </p>
                      </div>

                      <div>
                        <h5 className="font-medium mb-2">Test Duration</h5>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>
                            Running for {Math.ceil((new Date().getTime() - new Date(test.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                          </span>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium mb-2">Recommendations</h5>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {test.status === 'RUNNING' && test.confidenceLevel < 95 && (
                            <li>• Continue running the test to reach 95% confidence</li>
                          )}
                          {test.winner && (
                            <li>• {test.variants.find((v: any) => v.id === test.winner)?.name} shows {test.liftPercentage || 0}% improvement</li>
                          )}
                          <li>• Consider testing with different audience segments</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {test.status === 'COMPLETED' && test.winner && (
            <Button>
              Apply Winner to Campaign
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}