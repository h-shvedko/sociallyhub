'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Webhook,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Play,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
  Globe,
  Code,
  Key,
  Send
} from 'lucide-react'

interface WebhookDocumentationProps {
  className?: string
}

interface WebhookEvent {
  name: string
  description: string
  category: string
  payload: any
  example: any
  retryPolicy: {
    maxAttempts: number
    backoffMultiplier: number
    maxDelay: number
  }
}

const webhookEvents: WebhookEvent[] = [
  {
    name: 'post.published',
    description: 'Triggered when a post is successfully published to social media platforms',
    category: 'Posts',
    payload: {
      event: 'post.published',
      data: {
        post: {
          id: 'string',
          title: 'string',
          content: 'string',
          platforms: ['string'],
          publishedAt: 'datetime',
          status: 'published'
        },
        workspace: {
          id: 'string',
          name: 'string'
        },
        user: {
          id: 'string',
          email: 'string',
          name: 'string'
        }
      },
      timestamp: 'datetime'
    },
    example: {
      event: 'post.published',
      data: {
        post: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'My awesome post',
          content: 'Check out our latest product update! #innovation #tech',
          platforms: ['twitter', 'facebook', 'linkedin'],
          publishedAt: '2024-01-15T14:30:00Z',
          status: 'published'
        },
        workspace: {
          id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Acme Corp Marketing'
        },
        user: {
          id: '789e0123-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          name: 'John Doe'
        }
      },
      timestamp: '2024-01-15T14:30:05Z'
    },
    retryPolicy: {
      maxAttempts: 5,
      backoffMultiplier: 2,
      maxDelay: 300
    }
  },
  {
    name: 'post.failed',
    description: 'Triggered when a post fails to publish to one or more platforms',
    category: 'Posts',
    payload: {
      event: 'post.failed',
      data: {
        post: {
          id: 'string',
          title: 'string',
          content: 'string',
          platforms: ['string'],
          status: 'failed'
        },
        error: {
          code: 'string',
          message: 'string',
          platform: 'string',
          details: 'object'
        },
        workspace: {
          id: 'string',
          name: 'string'
        }
      },
      timestamp: 'datetime'
    },
    example: {
      event: 'post.failed',
      data: {
        post: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'My awesome post',
          content: 'Check out our latest product update!',
          platforms: ['twitter', 'facebook'],
          status: 'failed'
        },
        error: {
          code: 'PLATFORM_ERROR',
          message: 'Twitter API rate limit exceeded',
          platform: 'twitter',
          details: {
            rateLimitReset: '2024-01-15T15:00:00Z',
            remainingAttempts: 0
          }
        },
        workspace: {
          id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Acme Corp Marketing'
        }
      },
      timestamp: '2024-01-15T14:30:05Z'
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      maxDelay: 180
    }
  },
  {
    name: 'user.invited',
    description: 'Triggered when a new user is invited to a workspace',
    category: 'Team',
    payload: {
      event: 'user.invited',
      data: {
        invitation: {
          id: 'string',
          email: 'string',
          role: 'string',
          invitedBy: 'string',
          expiresAt: 'datetime'
        },
        workspace: {
          id: 'string',
          name: 'string'
        }
      },
      timestamp: 'datetime'
    },
    example: {
      event: 'user.invited',
      data: {
        invitation: {
          id: '321e4567-e89b-12d3-a456-426614174000',
          email: 'newuser@example.com',
          role: 'EDITOR',
          invitedBy: 'admin@example.com',
          expiresAt: '2024-01-22T14:30:00Z'
        },
        workspace: {
          id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Acme Corp Marketing'
        }
      },
      timestamp: '2024-01-15T14:30:00Z'
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffMultiplier: 1.5,
      maxDelay: 120
    }
  },
  {
    name: 'analytics.updated',
    description: 'Triggered when analytics data is updated for posts or campaigns',
    category: 'Analytics',
    payload: {
      event: 'analytics.updated',
      data: {
        type: 'post | campaign | workspace',
        id: 'string',
        metrics: {
          impressions: 'number',
          engagements: 'number',
          clicks: 'number',
          shares: 'number',
          engagementRate: 'number'
        },
        period: {
          startDate: 'date',
          endDate: 'date'
        },
        workspace: {
          id: 'string',
          name: 'string'
        }
      },
      timestamp: 'datetime'
    },
    example: {
      event: 'analytics.updated',
      data: {
        type: 'post',
        id: '123e4567-e89b-12d3-a456-426614174000',
        metrics: {
          impressions: 5420,
          engagements: 312,
          clicks: 89,
          shares: 23,
          engagementRate: 5.76
        },
        period: {
          startDate: '2024-01-15',
          endDate: '2024-01-15'
        },
        workspace: {
          id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Acme Corp Marketing'
        }
      },
      timestamp: '2024-01-16T02:00:00Z'
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      maxDelay: 300
    }
  },
  {
    name: 'campaign.completed',
    description: 'Triggered when a campaign reaches its end date or is manually completed',
    category: 'Campaigns',
    payload: {
      event: 'campaign.completed',
      data: {
        campaign: {
          id: 'string',
          name: 'string',
          type: 'string',
          status: 'completed',
          startDate: 'datetime',
          endDate: 'datetime',
          totalPosts: 'number'
        },
        summary: {
          totalImpressions: 'number',
          totalEngagements: 'number',
          averageEngagementRate: 'number',
          bestPerformingPost: 'string'
        },
        workspace: {
          id: 'string',
          name: 'string'
        }
      },
      timestamp: 'datetime'
    },
    example: {
      event: 'campaign.completed',
      data: {
        campaign: {
          id: '654e3210-e89b-12d3-a456-426614174000',
          name: 'Q1 Product Launch',
          type: 'product_launch',
          status: 'completed',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-15T23:59:59Z',
          totalPosts: 25
        },
        summary: {
          totalImpressions: 125000,
          totalEngagements: 8750,
          averageEngagementRate: 7.0,
          bestPerformingPost: '123e4567-e89b-12d3-a456-426614174000'
        },
        workspace: {
          id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Acme Corp Marketing'
        }
      },
      timestamp: '2024-01-16T00:00:05Z'
    },
    retryPolicy: {
      maxAttempts: 5,
      backoffMultiplier: 2,
      maxDelay: 600
    }
  }
]

export function WebhookDocumentation({ className = '' }: WebhookDocumentationProps) {
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [testResult, setTestResult] = useState<any>(null)

  const categories = Array.from(new Set(webhookEvents.map(event => event.category)))

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const generateSignatureExample = () => {
    return `// Node.js signature verification example
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express middleware
app.use('/webhooks', express.raw({ type: 'application/json' }), (req, res, next) => {
  const signature = req.headers['x-sociallyhub-signature'];
  const payload = req.body.toString();
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized');
  }
  
  req.body = JSON.parse(payload);
  next();
});`
  }

  const testWebhook = async () => {
    if (!webhookUrl || !selectedEvent) return

    try {
      const testPayload = selectedEvent.example
      
      // Simulate webhook delivery
      setTestResult({
        status: 'success',
        statusCode: 200,
        responseTime: 145,
        payload: testPayload
      })
    } catch (error) {
      setTestResult({
        status: 'error',
        error: 'Failed to deliver webhook',
        statusCode: 500
      })
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Webhook className="h-6 w-6" />
            <span>Webhook Documentation</span>
          </h1>
          <p className="text-muted-foreground">
            Real-time notifications for events in your SociallyHub workspace
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Event Reference</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle>What are Webhooks?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Webhooks allow your application to receive real-time notifications when specific events 
                occur in your SociallyHub workspace. Instead of polling our API for changes, we'll 
                send HTTP POST requests to your specified endpoint whenever something important happens.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <h4 className="font-semibold">Real-time</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get notified instantly when events occur
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <h4 className="font-semibold">Secure</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    HMAC signature verification ensures authenticity
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4 text-blue-600" />
                    <h4 className="font-semibold">Reliable</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatic retries with exponential backoff
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Facts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{webhookEvents.length}</div>
                <div className="text-sm text-muted-foreground">Available Events</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">30s</div>
                <div className="text-sm text-muted-foreground">Timeout</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">5</div>
                <div className="text-sm text-muted-foreground">Max Retries</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">HMAC</div>
                <div className="text-sm text-muted-foreground">Signature</div>
              </CardContent>
            </Card>
          </div>

          {/* Event Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Event Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => {
                  const categoryEvents = webhookEvents.filter(e => e.category === category)
                  return (
                    <div key={category} className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">{category}</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {categoryEvents.length} event{categoryEvents.length > 1 ? 's' : ''} available
                      </p>
                      <div className="space-y-1">
                        {categoryEvents.map(event => (
                          <Badge key={event.name} variant="outline" className="text-xs">
                            {event.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event List */}
            <div className="space-y-2">
              <h3 className="font-semibold">Available Events</h3>
              {webhookEvents.map(event => (
                <Card
                  key={event.name}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedEvent?.name === event.name ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-sm font-mono">{event.name}</code>
                      <Badge variant="outline" className="text-xs">
                        {event.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Event Details */}
            <div className="lg:col-span-2">
              {selectedEvent ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <code>{selectedEvent.name}</code>
                        </CardTitle>
                        <p className="text-muted-foreground mt-1">
                          {selectedEvent.description}
                        </p>
                      </div>
                      <Badge>{selectedEvent.category}</Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Payload Schema */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Payload Schema</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(selectedEvent.payload, null, 2))}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                        <code>{JSON.stringify(selectedEvent.payload, null, 2)}</code>
                      </pre>
                    </div>

                    {/* Example Payload */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Example Payload</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(selectedEvent.example, null, 2))}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-64">
                        <code>{JSON.stringify(selectedEvent.example, null, 2)}</code>
                      </pre>
                    </div>

                    {/* Retry Policy */}
                    <div>
                      <h4 className="font-semibold mb-2">Retry Policy</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-muted/50 rounded">
                          <div className="text-lg font-semibold">
                            {selectedEvent.retryPolicy.maxAttempts}
                          </div>
                          <div className="text-xs text-muted-foreground">Max Attempts</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded">
                          <div className="text-lg font-semibold">
                            {selectedEvent.retryPolicy.backoffMultiplier}x
                          </div>
                          <div className="text-xs text-muted-foreground">Backoff Multiplier</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded">
                          <div className="text-lg font-semibold">
                            {selectedEvent.retryPolicy.maxDelay}s
                          </div>
                          <div className="text-xs text-muted-foreground">Max Delay</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="flex items-center justify-center h-64">
                  <div className="text-center text-muted-foreground">
                    <Webhook className="h-12 w-12 mx-auto mb-4" />
                    <p>Select an event to view its documentation</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
          {/* Setup Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Setup Your Webhook Endpoint</CardTitle>
              <p className="text-muted-foreground">
                Follow these steps to start receiving webhook notifications
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Create Your Endpoint</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Set up an HTTP endpoint that can receive POST requests. Your endpoint should:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Accept JSON payloads</li>
                      <li>• Return a 200 status code for successful processing</li>
                      <li>• Respond within 30 seconds</li>
                      <li>• Verify the webhook signature (recommended)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Register Your Webhook</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Use the API to register your webhook endpoint:
                    </p>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{`curl -X POST https://api.sociallyhub.com/v1/workspaces/{workspaceId}/webhooks \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/sociallyhub",
    "events": ["post.published", "post.failed", "user.invited"]
  }'`}</code>
                    </pre>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Handle Events</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Process incoming webhook events in your application. See the example code in the next tab.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Example Implementation */}
          <Card>
            <CardHeader>
              <CardTitle>Example Implementation</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="nodejs">
                <TabsList>
                  <TabsTrigger value="nodejs">Node.js/Express</TabsTrigger>
                  <TabsTrigger value="python">Python/Flask</TabsTrigger>
                  <TabsTrigger value="php">PHP</TabsTrigger>
                </TabsList>

                <TabsContent value="nodejs">
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-96">
                    <code>{`const express = require('express');
const crypto = require('crypto');
const app = express();

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.use('/webhook', express.raw({ type: 'application/json' }));

app.post('/webhook/sociallyhub', (req, res) => {
  const signature = req.headers['x-sociallyhub-signature'];
  const payload = req.body.toString();
  
  // Verify signature
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized');
  }
  
  const event = JSON.parse(payload);
  
  // Handle different event types
  switch (event.event) {
    case 'post.published':
      console.log('Post published:', event.data.post.title);
      // Send notification, update database, etc.
      break;
      
    case 'post.failed':
      console.error('Post failed:', event.data.error.message);
      // Alert team, log error, etc.
      break;
      
    case 'user.invited':
      console.log('User invited:', event.data.invitation.email);
      // Send welcome email, etc.
      break;
  }
  
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="python">
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-96">
                    <code>{`from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

def verify_signature(payload, signature, secret):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook/sociallyhub', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-SociallyHub-Signature')
    payload = request.get_data(as_text=True)
    
    # Verify signature
    if not verify_signature(payload, signature, 'YOUR_WEBHOOK_SECRET'):
        return 'Unauthorized', 401
    
    event = json.loads(payload)
    
    # Handle different event types
    if event['event'] == 'post.published':
        print(f"Post published: {event['data']['post']['title']}")
        # Handle post published event
        
    elif event['event'] == 'post.failed':
        print(f"Post failed: {event['data']['error']['message']}")
        # Handle post failed event
        
    elif event['event'] == 'user.invited':
        print(f"User invited: {event['data']['invitation']['email']}")
        # Handle user invited event
    
    return jsonify({'received': True})

if __name__ == '__main__':
    app.run(port=3000)`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="php">
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto max-h-96">
                    <code>{`<?php
function verifySignature($payload, $signature, $secret) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($signature, $expectedSignature);
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SOCIALLYHUB_SIGNATURE'] ?? '';

// Verify signature
if (!verifySignature($payload, $signature, 'YOUR_WEBHOOK_SECRET')) {
    http_response_code(401);
    exit('Unauthorized');
}

$event = json_decode($payload, true);

// Handle different event types
switch ($event['event']) {
    case 'post.published':
        error_log('Post published: ' . $event['data']['post']['title']);
        // Handle post published event
        break;
        
    case 'post.failed':
        error_log('Post failed: ' . $event['data']['error']['message']);
        // Handle post failed event
        break;
        
    case 'user.invited':
        error_log('User invited: ' . $event['data']['invitation']['email']);
        // Handle user invited event
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);
?>`}</code>
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          {/* Webhook Testing Tool */}
          <Card>
            <CardHeader>
              <CardTitle>Test Your Webhook</CardTitle>
              <p className="text-muted-foreground">
                Use this tool to test your webhook endpoint with sample payloads
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://your-app.com/webhook/sociallyhub"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={selectedEvent?.name || 'none'}
                    onChange={(e) => {
                      const event = webhookEvents.find(ev => ev.name === e.target.value)
                      setSelectedEvent(event || null)
                    }}
                  >
                    <option value="none">Select an event type</option>
                    {webhookEvents.map(event => (
                      <option key={event.name} value={event.name}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={testWebhook}
                  disabled={!webhookUrl || !selectedEvent}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Event
                </Button>
              </div>

              {testResult && (
                <Card className="mt-4">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      {testResult.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-semibold">
                        Test {testResult.status === 'success' ? 'Successful' : 'Failed'}
                      </span>
                      {testResult.statusCode && (
                        <Badge variant={testResult.statusCode === 200 ? 'default' : 'destructive'}>
                          {testResult.statusCode}
                        </Badge>
                      )}
                      {testResult.responseTime && (
                        <span className="text-sm text-muted-foreground">
                          {testResult.responseTime}ms
                        </span>
                      )}
                    </div>
                    
                    {testResult.payload && (
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">
                        <code>{JSON.stringify(testResult.payload, null, 2)}</code>
                      </pre>
                    )}
                    
                    {testResult.error && (
                      <p className="text-sm text-red-600">{testResult.error}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Testing Tools */}
          <Card>
            <CardHeader>
              <CardTitle>Testing Tools & Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Use these tools to test and debug your webhook integrations:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">ngrok</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Create secure tunnels to your localhost for testing
                  </p>
                  <code className="text-xs bg-muted p-1 rounded">ngrok http 3000</code>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">webhook.site</h4>
                  <p className="text-sm text-muted-foreground">
                    Test endpoint that captures and displays webhook payloads
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">RequestBin</h4>
                  <p className="text-sm text-muted-foreground">
                    Collect and inspect HTTP requests from webhooks
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Postman</h4>
                  <p className="text-sm text-muted-foreground">
                    Mock servers and API testing for webhook development
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {/* Security Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Webhook Security</span>
              </CardTitle>
              <p className="text-muted-foreground">
                Best practices for securing your webhook endpoints
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-2">
                      <Key className="h-4 w-4" />
                      <span>Signature Verification</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Always verify webhook signatures to ensure requests are from SociallyHub
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-2">
                      <Globe className="h-4 w-4" />
                      <span>HTTPS Only</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Use HTTPS endpoints to protect data in transit
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>Idempotency</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Handle duplicate deliveries gracefully using event IDs
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Error Handling</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Return appropriate HTTP status codes and handle retries
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span>Rate Limiting</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Implement rate limiting to protect your infrastructure
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Monitoring</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor webhook deliveries and set up alerts for failures
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signature Verification Details */}
          <Card>
            <CardHeader>
              <CardTitle>Signature Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                SociallyHub signs webhook payloads using HMAC-SHA256. The signature is included 
                in the <code>X-SociallyHub-Signature</code> header.
              </p>
              
              <div className="space-y-2">
                <Label>Verification Example</Label>
                <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                  <code>{generateSignatureExample()}</code>
                </pre>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">Important Notes:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use the raw request body for signature verification</li>
                  <li>• Store your webhook secret securely (environment variables recommended)</li>
                  <li>• Use timing-safe comparison functions to prevent timing attacks</li>
                  <li>• Regenerate secrets periodically for better security</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Headers Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Request Headers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Header</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2"><code>Content-Type</code></td>
                        <td className="p-2">Always application/json</td>
                        <td className="p-2">application/json</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>X-SociallyHub-Signature</code></td>
                        <td className="p-2">HMAC signature for verification</td>
                        <td className="p-2">sha256=abc123...</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>X-SociallyHub-Delivery</code></td>
                        <td className="p-2">Unique delivery ID</td>
                        <td className="p-2">12345678-1234-1234-1234-123456789012</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>X-SociallyHub-Event</code></td>
                        <td className="p-2">Event type</td>
                        <td className="p-2">post.published</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>User-Agent</code></td>
                        <td className="p-2">SociallyHub webhook user agent</td>
                        <td className="p-2">SociallyHub-Webhooks/1.0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}