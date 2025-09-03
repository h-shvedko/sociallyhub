'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Search,
  Send,
  Copy,
  Download,
  ChevronDown,
  ChevronRight,
  Code,
  Book,
  Zap,
  Lock,
  Key,
  Globe,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react'

interface ApiExplorerProps {
  className?: string
}

interface EndpointInfo {
  method: string
  path: string
  summary: string
  description: string
  tags: string[]
  security: string[]
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses: Response[]
}

interface Parameter {
  name: string
  in: 'path' | 'query' | 'header'
  required: boolean
  type: string
  description: string
  example?: any
}

interface RequestBody {
  required: boolean
  contentType: string
  schema: any
  example?: any
}

interface Response {
  status: string
  description: string
  example?: any
}

interface RequestHistory {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  timestamp: Date
  response?: {
    status: number
    headers: Record<string, string>
    body: any
    duration: number
  }
}

// Mock API endpoints data
const mockEndpoints: EndpointInfo[] = [
  {
    method: 'POST',
    path: '/auth/login',
    summary: 'User login',
    description: 'Authenticate user with email and password',
    tags: ['Authentication'],
    security: [],
    requestBody: {
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        }
      },
      example: {
        email: 'user@example.com',
        password: 'SecurePass123!'
      }
    },
    responses: [
      {
        status: '200',
        description: 'Login successful',
        example: {
          success: true,
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@example.com',
              name: 'John Doe'
            }
          }
        }
      },
      {
        status: '401',
        description: 'Invalid credentials',
        example: {
          error: 'invalid_credentials',
          message: 'Invalid email or password.'
        }
      }
    ]
  },
  {
    method: 'GET',
    path: '/workspaces/{workspaceId}/posts',
    summary: 'List posts',
    description: 'Get posts for a workspace',
    tags: ['Posts'],
    security: ['Bearer Token'],
    parameters: [
      {
        name: 'workspaceId',
        in: 'path',
        required: true,
        type: 'string',
        description: 'Workspace ID',
        example: '123e4567-e89b-12d3-a456-426614174000'
      },
      {
        name: 'page',
        in: 'query',
        required: false,
        type: 'integer',
        description: 'Page number',
        example: 1
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        type: 'integer',
        description: 'Items per page',
        example: 20
      },
      {
        name: 'status',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Filter by status',
        example: 'published'
      }
    ],
    responses: [
      {
        status: '200',
        description: 'List of posts',
        example: {
          success: true,
          data: [
            {
              id: '456e7890-e89b-12d3-a456-426614174000',
              title: 'Sample Post',
              content: 'This is a sample post content.',
              status: 'published',
              platforms: ['twitter', 'facebook'],
              createdAt: '2024-01-15T10:30:00Z'
            }
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 50,
            totalPages: 3
          }
        }
      }
    ]
  }
]

export function ApiExplorer({ className = '' }: ApiExplorerProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [requestData, setRequestData] = useState<{
    headers: Record<string, string>
    parameters: Record<string, string>
    body: string
  }>({
    headers: {},
    parameters: {},
    body: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [history, setHistory] = useState<RequestHistory[]>([])
  const [showResponse, setShowResponse] = useState(false)
  const [authToken, setAuthToken] = useState('')

  const filteredEndpoints = mockEndpoints.filter(endpoint => {
    const matchesSearch = !searchQuery || 
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.summary.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesTag = selectedTag === 'all' || endpoint.tags.includes(selectedTag)
    
    return matchesSearch && matchesTag
  })

  const allTags = ['all', ...Array.from(new Set(mockEndpoints.flatMap(e => e.tags)))]

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'PUT': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'PATCH': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const handleParameterChange = (paramName: string, value: string) => {
    setRequestData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramName]: value
      }
    }))
  }

  const handleHeaderChange = (headerName: string, value: string) => {
    setRequestData(prev => ({
      ...prev,
      headers: {
        ...prev.headers,
        [headerName]: value
      }
    }))
  }

  const generateCurlCommand = () => {
    if (!selectedEndpoint) return ''

    let url = `https://api.sociallyhub.com/v1${selectedEndpoint.path}`
    
    // Replace path parameters
    if (selectedEndpoint.parameters) {
      selectedEndpoint.parameters
        .filter(p => p.in === 'path')
        .forEach(param => {
          const value = requestData.parameters[param.name] || `{${param.name}}`
          url = url.replace(`{${param.name}}`, value)
        })
    }

    // Add query parameters
    const queryParams = selectedEndpoint.parameters
      ?.filter(p => p.in === 'query' && requestData.parameters[p.name])
      .map(p => `${p.name}=${encodeURIComponent(requestData.parameters[p.name])}`)
    
    if (queryParams && queryParams.length > 0) {
      url += `?${queryParams.join('&')}`
    }

    let curl = `curl -X ${selectedEndpoint.method} "${url}"`
    
    // Add headers
    const headers = { ...requestData.headers }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    
    Object.entries(headers).forEach(([key, value]) => {
      if (value) curl += ` \\\n  -H "${key}: ${value}"`
    })

    // Add body
    if (selectedEndpoint.requestBody && requestData.body) {
      curl += ` \\\n  -d '${requestData.body}'`
    }

    return curl
  }

  const handleSendRequest = async () => {
    if (!selectedEndpoint) return

    setIsLoading(true)
    setShowResponse(true)

    const requestId = Date.now().toString()
    const timestamp = new Date()

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockResponse = {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: selectedEndpoint.responses[0]?.example || { success: true },
        duration: 234
      }

      setResponse(mockResponse)
      
      const historyItem: RequestHistory = {
        id: requestId,
        method: selectedEndpoint.method,
        url: selectedEndpoint.path,
        headers: requestData.headers,
        body: requestData.body || undefined,
        timestamp,
        response: mockResponse
      }

      setHistory(prev => [historyItem, ...prev.slice(0, 9)])
    } catch (error) {
      const errorResponse = {
        status: 500,
        headers: {},
        body: { error: 'Internal Server Error' },
        duration: 0
      }
      setResponse(errorResponse)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className={`flex h-screen ${className}`}>
      {/* Sidebar - Endpoint List */}
      <div className="w-1/3 border-r bg-muted/30">
        <div className="p-4 border-b">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag === 'all' ? 'All Tags' : tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {filteredEndpoints.map((endpoint, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedEndpoint === endpoint ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedEndpoint(endpoint)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getMethodColor(endpoint.method)}>
                      {endpoint.method}
                    </Badge>
                    {endpoint.security.length > 0 && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <code className="text-sm font-mono">{endpoint.path}</code>
                    <p className="text-sm text-muted-foreground">{endpoint.summary}</p>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content - API Testing Interface */}
      <div className="flex-1 flex flex-col">
        {selectedEndpoint ? (
          <>
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Badge className={getMethodColor(selectedEndpoint.method)}>
                    {selectedEndpoint.method}
                  </Badge>
                  <code className="text-lg font-mono">{selectedEndpoint.path}</code>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedEndpoint.security.length > 0 && (
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 mr-1" />
                      Requires Auth
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground">{selectedEndpoint.description}</p>
            </div>

            <div className="flex-1 flex">
              {/* Request Configuration */}
              <div className="w-1/2 p-6 space-y-6">
                <Tabs defaultValue="parameters">
                  <TabsList>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    {selectedEndpoint.requestBody && (
                      <TabsTrigger value="body">Body</TabsTrigger>
                    )}
                    <TabsTrigger value="auth">Auth</TabsTrigger>
                  </TabsList>

                  <TabsContent value="parameters" className="space-y-4">
                    {selectedEndpoint.parameters ? (
                      selectedEndpoint.parameters.map(param => (
                        <div key={param.name} className="space-y-2">
                          <Label className="flex items-center space-x-2">
                            <span>{param.name}</span>
                            {param.required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">{param.in}</Badge>
                          </Label>
                          <Input
                            placeholder={param.description}
                            value={requestData.parameters[param.name] || ''}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          />
                          {param.example && (
                            <p className="text-xs text-muted-foreground">
                              Example: {JSON.stringify(param.example)}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No parameters required</p>
                    )}
                  </TabsContent>

                  <TabsContent value="headers" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Custom Headers</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Header name" />
                        <Input placeholder="Header value" />
                      </div>
                      <Button variant="outline" size="sm">Add Header</Button>
                    </div>
                  </TabsContent>

                  {selectedEndpoint.requestBody && (
                    <TabsContent value="body" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Request Body</Label>
                        <Textarea
                          placeholder="JSON request body"
                          value={requestData.body}
                          onChange={(e) => setRequestData(prev => ({ ...prev, body: e.target.value }))}
                          rows={10}
                          className="font-mono text-sm"
                        />
                        {selectedEndpoint.requestBody.example && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRequestData(prev => ({
                              ...prev,
                              body: JSON.stringify(selectedEndpoint.requestBody!.example, null, 2)
                            }))}
                          >
                            Use Example
                          </Button>
                        )}
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="auth" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bearer Token</Label>
                      <div className="flex space-x-2">
                        <Input
                          type="password"
                          placeholder="Enter your API token"
                          value={authToken}
                          onChange={(e) => setAuthToken(e.target.value)}
                        />
                        <Button variant="outline" size="sm">
                          <Key className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <Separator />

                <div className="space-y-4">
                  <Button
                    onClick={handleSendRequest}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Request
                      </>
                    )}
                  </Button>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Code className="h-4 w-4 mr-2" />
                        View cURL Command
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="mt-2">
                        <CardContent className="p-4">
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {generateCurlCommand()}
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => copyToClipboard(generateCurlCommand())}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>

              {/* Response Section */}
              <div className="w-1/2 border-l">
                <Tabs defaultValue="response" className="h-full flex flex-col">
                  <div className="p-6 border-b">
                    <TabsList>
                      <TabsTrigger value="response">Response</TabsTrigger>
                      <TabsTrigger value="examples">Examples</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="response" className="flex-1 p-6">
                    {showResponse && response ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge className={response.status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {response.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {response.duration}ms
                            </span>
                          </div>
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Response Body</Label>
                          <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                            {JSON.stringify(response.body, null, 2)}
                          </pre>
                        </div>

                        <div className="space-y-2">
                          <Label>Response Headers</Label>
                          <pre className="bg-muted p-4 rounded text-xs">
                            {Object.entries(response.headers).map(([key, value]) => 
                              `${key}: ${value}`
                            ).join('\n')}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Zap className="h-12 w-12 mx-auto mb-4" />
                          <p>Send a request to see the response here</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="examples" className="flex-1 p-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold">Response Examples</h3>
                      {selectedEndpoint.responses.map((response, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center space-x-2">
                              <Badge className={response.status.startsWith('2') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {response.status}
                              </Badge>
                              <span className="text-sm">{response.description}</span>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {response.example && (
                              <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                                {JSON.stringify(response.example, null, 2)}
                              </pre>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="flex-1 p-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold">Request History</h3>
                      {history.length > 0 ? (
                        history.map((item) => (
                          <Card key={item.id} className="cursor-pointer hover:bg-muted/50">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Badge className={getMethodColor(item.method)}>
                                    {item.method}
                                  </Badge>
                                  <code className="text-sm">{item.url}</code>
                                </div>
                                {item.response && (
                                  <Badge className={item.response.status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                    {item.response.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.timestamp.toLocaleString()}
                              </p>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center">No requests made yet</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Book className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Welcome to API Explorer</h3>
              <p>Select an endpoint from the sidebar to start testing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}