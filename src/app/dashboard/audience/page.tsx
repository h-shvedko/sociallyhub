'use client'

// ADR-0018 Track D: mounts the (previously orphaned) src/components/audience/* UI.
//
// HONESTY NOTE — AudienceIntelligenceDashboard is intentionally NOT mounted here:
// its "Overview" tab consists entirely of hardcoded fabricated data (a fake
// "125.4K" audience, invented "AI-Powered Insights", made-up per-platform
// stats), and its remaining tabs merely re-embed the three dashboards mounted
// below. Rendering it would violate the no-fabricated-data rule. Deletion or an
// honest rewrite is the main session's call (reported by this track).

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AudienceSegmentationDashboard } from '@/components/audience/audience-segmentation-dashboard'
import { PostingTimeDashboard } from '@/components/audience/posting-time-dashboard'
import { SentimentDashboard } from '@/components/audience/sentiment-dashboard'
import { useAIStatus } from '@/hooks/use-ai-status'
import { Bot, Clock, Heart, Target } from 'lucide-react'

export default function AudiencePage() {
  const { status, loading } = useAIStatus()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audience</h1>
          <p className="text-muted-foreground">Checking AI availability…</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!status || status.provider === 'none') {
    // Honest unavailable state — no fake charts, no placeholder numbers.
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audience</h1>
          <p className="text-muted-foreground">
            AI-powered audience segments, posting-time recommendations and sentiment analysis
          </p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">
              AI features are unavailable — configure OPENAI_API_KEY
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {status?.reason ?? 'Configure OPENAI_API_KEY to enable AI features'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audience</h1>
          <p className="text-muted-foreground">
            AI-powered audience segments, posting-time recommendations and sentiment analysis
          </p>
        </div>
        {status.provider === 'mock' && (
          <Badge className="w-fit bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
            Simulated (demo)
          </Badge>
        )}
      </div>

      <Tabs defaultValue="segments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Segments</span>
          </TabsTrigger>
          <TabsTrigger value="posting-times" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Posting Times</span>
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Sentiment</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="segments">
          <AudienceSegmentationDashboard />
        </TabsContent>

        <TabsContent value="posting-times">
          <PostingTimeDashboard />
        </TabsContent>

        <TabsContent value="sentiment">
          <SentimentDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
