'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Code,
  Globe,
  ArrowRight,
  Copy,
  ExternalLink
} from 'lucide-react'
import { VERSION_CONFIGS, ApiVersion, CURRENT_VERSION, DEPRECATED_VERSIONS } from '@/lib/api-docs/versioning'

interface ApiVersioningProps {
  className?: string
}

export function ApiVersioning({ className }: ApiVersioningProps) {
  const [copiedExample, setCopiedExample] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedExample(id)
    setTimeout(() => setCopiedExample(null), 2000)
  }

  const versioningMethods = [
    {
      id: 'path',
      name: 'URL Path',
      description: 'Include version in the URL path (recommended)',
      example: 'GET /api/v2/posts',
      pros: ['Clear and visible', 'Easy to cache', 'RESTful'],
      cons: ['Requires URL changes for new versions']
    },
    {
      id: 'header',
      name: 'Custom Header',
      description: 'Use X-API-Version header',
      example: 'X-API-Version: v2',
      pros: ['Clean URLs', 'Easy to implement'],
      cons: ['Less visible', 'Caching complexity']
    },
    {
      id: 'accept',
      name: 'Accept Header',
      description: 'Use vendor-specific media type',
      example: 'Accept: application/vnd.sociallyhub.v2+json',
      pros: ['HTTP standard', 'Content negotiation'],
      cons: ['More complex', 'Less intuitive']
    }
  ]

  const migrationGuide = {
    'v1': {
      title: 'Migrating from v1 to v2',
      changes: [
        {
          type: 'Authentication',
          description: 'Response format changed',
          v1: '{ "user": {...}, "token": "...", "expires": 3600 }',
          v2: '{ "data": { "user": {...}, "accessToken": "...", "refreshToken": "...", "expiresIn": 3600 } }'
        },
        {
          type: 'Posts Creation',
          description: 'Enhanced payload structure',
          v1: '{ "content": "text", "platforms": ["twitter"] }',
          v2: '{ "text": "text", "platforms": ["twitter"], "scheduledFor": "2024-01-01T10:00:00Z" }'
        },
        {
          type: 'Error Responses',
          description: 'Standardized error format',
          v1: '{ "error": "validation failed" }',
          v2: '{ "error": "validation_error", "message": "Validation failed", "details": [...] }'
        }
      ]
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <CardTitle>API Versioning</CardTitle>
          </div>
          <CardDescription>
            SociallyHub API uses semantic versioning to ensure backward compatibility and smooth migrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">v{CURRENT_VERSION.slice(1)}</div>
              <div className="text-sm text-muted-foreground">Current Version</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Object.keys(VERSION_CONFIGS).length}</div>
              <div className="text-sm text-muted-foreground">Total Versions</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{DEPRECATED_VERSIONS.length}</div>
              <div className="text-sm text-muted-foreground">Deprecated</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="versions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        {/* Version Information */}
        <TabsContent value="versions" className="space-y-4">
          {Object.entries(VERSION_CONFIGS).map(([version, config]) => (
            <Card key={version} className={config.isDeprecated ? 'border-orange-200 dark:border-orange-800' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">API {version.toUpperCase()}</CardTitle>
                    <div className="flex gap-2">
                      {version === CURRENT_VERSION && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Current
                        </Badge>
                      )}
                      {config.isDeprecated && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Deprecated
                        </Badge>
                      )}
                    </div>
                  </div>
                  {config.isDeprecated && config.sunsetDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Sunset: {new Date(config.sunsetDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config.isDeprecated && (
                  <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This version is deprecated since {config.deprecationDate && new Date(config.deprecationDate).toLocaleDateString()}.
                      {config.sunsetDate && ` It will be discontinued on ${new Date(config.sunsetDate).toLocaleDateString()}.`}
                      Please migrate to v{CURRENT_VERSION.slice(1)}.
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <h4 className="font-medium mb-2">Features & Changes</h4>
                  <ul className="space-y-1 text-sm">
                    {config.changes.map((change, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>

                {config.breakingChanges && config.breakingChanges.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-orange-600 dark:text-orange-400">Breaking Changes</h4>
                    <ul className="space-y-1 text-sm">
                      {config.breakingChanges.map((change, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Versioning Methods */}
        <TabsContent value="methods" className="space-y-4">
          <div className="grid gap-4">
            {versioningMethods.map((method) => (
              <Card key={method.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{method.name}</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(method.example, method.id)}
                    >
                      {copiedExample === method.id ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>{method.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <code className="text-sm font-mono">{method.example}</code>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">Pros</h4>
                      <ul className="space-y-1 text-sm">
                        {method.pros.map((pro, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-orange-600 dark:text-orange-400 mb-2">Cons</h4>
                      <ul className="space-y-1 text-sm">
                        {method.cons.map((con, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Migration Guide */}
        <TabsContent value="migration" className="space-y-4">
          {Object.entries(migrationGuide).map(([version, guide]) => (
            <Card key={version}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  {guide.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {guide.changes.map((change, index) => (
                    <div key={index} className="space-y-3">
                      <h4 className="font-medium">{change.type}</h4>
                      <p className="text-sm text-muted-foreground">{change.description}</p>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">v1 (Old)</div>
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <pre className="text-xs font-mono overflow-x-auto">{change.v1}</pre>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">v2 (New)</div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                            <pre className="text-xs font-mono overflow-x-auto">{change.v2}</pre>
                          </div>
                        </div>
                      </div>
                      
                      {index < guide.changes.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Code Examples */}
        <TabsContent value="examples" className="space-y-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>JavaScript/Node.js Examples</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Using URL Path Versioning</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <pre className="text-sm overflow-x-auto">
{`// Fetch posts using v2 API
const response = await fetch('https://api.sociallyhub.com/api/v2/posts', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
})

const data = await response.json()
console.log('API Version:', response.headers.get('X-API-Version'))`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Using Header Versioning</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <pre className="text-sm overflow-x-auto">
{`// Fetch posts using header versioning
const response = await fetch('https://api.sociallyhub.com/api/posts', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'X-API-Version': 'v2',
    'Content-Type': 'application/json'
  }
})

// Check for deprecation warnings
const warning = response.headers.get('Warning')
if (warning) {
  console.warn('API Version Warning:', warning)
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Version Detection Utility</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <pre className="text-sm overflow-x-auto">
{`class SociallyHubAPI {
  constructor(token, version = 'v2') {
    this.token = token
    this.version = version
    this.baseURL = 'https://api.sociallyhub.com/api'
  }
  
  async makeRequest(endpoint, options = {}) {
    const url = \`\${this.baseURL}/\${this.version}\${endpoint}\`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${this.token}\`,
        'X-API-Version': this.version,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    
    // Handle version-specific responses
    const apiVersion = response.headers.get('X-API-Version')
    const isDeprecated = response.headers.get('X-API-Deprecated') === 'true'
    
    if (isDeprecated) {
      const sunsetDate = response.headers.get('X-API-Sunset-Date')
      console.warn(\`API version \${apiVersion} is deprecated. Sunset date: \${sunsetDate}\`)
    }
    
    return response.json()
  }
}

// Usage
const api = new SociallyHubAPI('your-token', 'v2')
const posts = await api.makeRequest('/posts')`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Python Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto">
{`import requests
from typing import Optional

class SociallyHubAPI:
    def __init__(self, token: str, version: str = 'v2'):
        self.token = token
        self.version = version
        self.base_url = 'https://api.sociallyhub.com/api'
        
    def make_request(self, endpoint: str, method: str = 'GET', **kwargs):
        url = f"{self.base_url}/{self.version}{endpoint}"
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'X-API-Version': self.version,
            'Content-Type': 'application/json',
            **kwargs.get('headers', {})
        }
        
        response = requests.request(method, url, headers=headers, **kwargs)
        
        # Check for deprecation warnings
        if response.headers.get('X-API-Deprecated') == 'true':
            sunset_date = response.headers.get('X-API-Sunset-Date')
            print(f"Warning: API version {self.version} is deprecated. "
                  f"Sunset date: {sunset_date}")
        
        return response.json()
    
    def get_posts(self, **params):
        return self.make_request('/posts', params=params)

# Usage
api = SociallyHubAPI('your-token', 'v2')
posts = api.get_posts(limit=10, status='published')`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start" asChild>
              <a href="/api/version" target="_blank">
                <Code className="h-4 w-4 mr-2" />
                Version Info API
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href="/api/docs" target="_blank">
                <Globe className="h-4 w-4 mr-2" />
                API Documentation
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href="/api/health" target="_blank">
                <CheckCircle className="h-4 w-4 mr-2" />
                API Health Check
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href="#migration" onClick={(e) => { e.preventDefault(); /* scroll to migration */ }}>
                <Calendar className="h-4 w-4 mr-2" />
                Migration Timeline
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}