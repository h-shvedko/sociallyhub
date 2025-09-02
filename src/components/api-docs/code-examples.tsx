'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Copy,
  Download,
  Code,
  Terminal,
  Smartphone,
  Globe,
  CheckCircle,
  ExternalLink
} from 'lucide-react'

interface CodeExamplesProps {
  className?: string
}

interface CodeExample {
  language: string
  label: string
  code: string
  description: string
  dependencies?: string[]
}

interface IntegrationExample {
  title: string
  description: string
  category: string
  examples: CodeExample[]
}

const integrationExamples: IntegrationExample[] = [
  {
    title: 'Authentication',
    description: 'How to authenticate with the SociallyHub API',
    category: 'Authentication',
    examples: [
      {
        language: 'javascript',
        label: 'JavaScript/Node.js',
        code: `// Install: npm install axios
const axios = require('axios');

const API_BASE_URL = 'https://api.sociallyhub.com/v1';

// Login to get access token
async function login(email, password) {
  try {
    const response = await axios.post(\`\${API_BASE_URL}/auth/login\`, {
      email,
      password
    });
    
    const { accessToken, refreshToken } = response.data.data;
    
    // Store tokens securely (e.g., in environment variables)
    process.env.ACCESS_TOKEN = accessToken;
    process.env.REFRESH_TOKEN = refreshToken;
    
    console.log('Login successful');
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Login failed:', error.response?.data?.message);
    throw error;
  }
}

// Create authenticated API client
function createApiClient(accessToken) {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'Content-Type': 'application/json'
    }
  });
}

// Usage
login('user@example.com', 'password123')
  .then(({ accessToken }) => {
    const apiClient = createApiClient(accessToken);
    // Now you can make authenticated requests
    return apiClient.get('/auth/me');
  })
  .then(response => {
    console.log('Current user:', response.data.data.user);
  });`,
        description: 'Authenticate and create an API client',
        dependencies: ['axios']
      },
      {
        language: 'python',
        label: 'Python',
        code: `# Install: pip install requests
import requests
import json
from typing import Dict, Optional

API_BASE_URL = 'https://api.sociallyhub.com/v1'

class SociallyHubAPI:
    def __init__(self, access_token: Optional[str] = None):
        self.base_url = API_BASE_URL
        self.access_token = access_token
        self.session = requests.Session()
        
        if access_token:
            self.session.headers.update({
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            })
    
    def login(self, email: str, password: str) -> Dict:
        """Login and get access token"""
        response = self.session.post(f'{self.base_url}/auth/login', json={
            'email': email,
            'password': password
        })
        
        if response.status_code == 200:
            data = response.json()['data']
            self.access_token = data['accessToken']
            self.session.headers.update({
                'Authorization': f'Bearer {self.access_token}'
            })
            return data
        else:
            raise Exception(f"Login failed: {response.json().get('message', 'Unknown error')}")
    
    def get_current_user(self) -> Dict:
        """Get current authenticated user"""
        response = self.session.get(f'{self.base_url}/auth/me')
        response.raise_for_status()
        return response.json()['data']

# Usage
api = SociallyHubAPI()
login_data = api.login('user@example.com', 'password123')
print(f"Login successful. Token expires in {login_data['expiresIn']} seconds")

user = api.get_current_user()
print(f"Current user: {user['user']['name']}")`,
        description: 'Python API client with authentication',
        dependencies: ['requests']
      },
      {
        language: 'php',
        label: 'PHP',
        code: `<?php
// Install: composer require guzzlehttp/guzzle

require_once 'vendor/autoload.php';

use GuzzleHttp\\Client;
use GuzzleHttp\\Exception\\RequestException;

class SociallyHubAPI {
    private $client;
    private $baseUrl = 'https://api.sociallyhub.com/v1';
    private $accessToken;
    
    public function __construct($accessToken = null) {
        $this->client = new Client(['base_uri' => $this->baseUrl]);
        $this->accessToken = $accessToken;
    }
    
    public function login($email, $password) {
        try {
            $response = $this->client->post('/auth/login', [
                'json' => [
                    'email' => $email,
                    'password' => $password
                ]
            ]);
            
            $data = json_decode($response->getBody(), true);
            $this->accessToken = $data['data']['accessToken'];
            
            return $data['data'];
        } catch (RequestException $e) {
            $error = json_decode($e->getResponse()->getBody(), true);
            throw new Exception("Login failed: " . $error['message']);
        }
    }
    
    public function getCurrentUser() {
        if (!$this->accessToken) {
            throw new Exception('Not authenticated. Please login first.');
        }
        
        try {
            $response = $this->client->get('/auth/me', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->accessToken,
                    'Content-Type' => 'application/json'
                ]
            ]);
            
            return json_decode($response->getBody(), true)['data'];
        } catch (RequestException $e) {
            throw new Exception('Failed to get current user');
        }
    }
}

// Usage
$api = new SociallyHubAPI();
$loginData = $api->login('user@example.com', 'password123');
echo "Login successful\\n";

$user = $api->getCurrentUser();
echo "Current user: " . $user['user']['name'] . "\\n";
?>`,
        description: 'PHP API client using Guzzle HTTP',
        dependencies: ['guzzlehttp/guzzle']
      }
    ]
  },
  {
    title: 'Creating and Publishing Posts',
    description: 'How to create and publish content across social media platforms',
    category: 'Content Management',
    examples: [
      {
        language: 'javascript',
        label: 'JavaScript/Node.js',
        code: `const apiClient = createApiClient(accessToken); // From previous example

async function createPost(workspaceId, postData) {
  try {
    const response = await apiClient.post(\`/workspaces/\${workspaceId}/posts\`, {
      title: postData.title,
      content: postData.content,
      mediaUrls: postData.mediaUrls || [],
      platforms: postData.platforms,
      scheduledAt: postData.scheduledAt,
      tags: postData.tags || [],
      platformSpecific: postData.platformSpecific || {}
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Failed to create post:', error.response?.data?.message);
    throw error;
  }
}

async function uploadMedia(workspaceId, file) {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await apiClient.post(\`/workspaces/\${workspaceId}/media\`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data.data.url;
  } catch (error) {
    console.error('Failed to upload media:', error.response?.data?.message);
    throw error;
  }
}

// Example: Create a post with image
async function createPostWithImage() {
  const workspaceId = 'your-workspace-id';
  
  // Upload image first
  const imageFile = new File([/* file data */], 'image.jpg', { type: 'image/jpeg' });
  const imageUrl = await uploadMedia(workspaceId, imageFile);
  
  // Create post
  const post = await createPost(workspaceId, {
    title: 'My awesome post',
    content: 'Check out this amazing content! #socialmedia #marketing',
    mediaUrls: [imageUrl],
    platforms: ['twitter', 'facebook', 'linkedin'],
    scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    tags: ['marketing', 'social-media'],
    platformSpecific: {
      twitter: {
        thread: false
      },
      facebook: {
        privacy: 'PUBLIC'
      },
      linkedin: {
        visibility: 'PUBLIC'
      }
    }
  });
  
  console.log('Post created:', post.id);
  return post;
}`,
        description: 'Create posts with media uploads and scheduling',
        dependencies: ['form-data']
      },
      {
        language: 'python',
        label: 'Python',
        code: `import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional

class PostManager:
    def __init__(self, api_client):
        self.api = api_client
    
    def create_post(self, workspace_id: str, 
                   content: str, 
                   platforms: List[str],
                   title: Optional[str] = None,
                   media_urls: Optional[List[str]] = None,
                   scheduled_at: Optional[str] = None,
                   tags: Optional[List[str]] = None,
                   platform_specific: Optional[Dict] = None) -> Dict:
        """Create a new social media post"""
        
        post_data = {
            'content': content,
            'platforms': platforms
        }
        
        if title:
            post_data['title'] = title
        if media_urls:
            post_data['mediaUrls'] = media_urls
        if scheduled_at:
            post_data['scheduledAt'] = scheduled_at
        if tags:
            post_data['tags'] = tags
        if platform_specific:
            post_data['platformSpecific'] = platform_specific
        
        response = self.api.session.post(
            f'{self.api.base_url}/workspaces/{workspace_id}/posts',
            json=post_data
        )
        response.raise_for_status()
        
        return response.json()['data']
    
    def upload_media(self, workspace_id: str, file_path: str) -> str:
        """Upload media file and return URL"""
        with open(file_path, 'rb') as file:
            files = {'file': file}
            response = self.api.session.post(
                f'{self.api.base_url}/workspaces/{workspace_id}/media',
                files=files
            )
        
        response.raise_for_status()
        return response.json()['data']['url']
    
    def schedule_recurring_posts(self, workspace_id: str, 
                               content_templates: List[str],
                               platforms: List[str],
                               schedule_times: List[str]) -> List[Dict]:
        """Schedule multiple posts with different content"""
        posts = []
        
        for i, content in enumerate(content_templates):
            # Calculate schedule time (next occurrence of specified time)
            scheduled_time = datetime.now() + timedelta(days=i+1)
            
            post = self.create_post(
                workspace_id=workspace_id,
                content=content,
                platforms=platforms,
                scheduled_at=scheduled_time.isoformat(),
                tags=['automated', 'recurring']
            )
            posts.append(post)
        
        return posts

# Usage example
api = SociallyHubAPI(access_token='your-access-token')
post_manager = PostManager(api)

# Upload an image
image_url = post_manager.upload_media('workspace-id', '/path/to/image.jpg')

# Create a post with the image
post = post_manager.create_post(
    workspace_id='workspace-id',
    title='New Product Launch',
    content='🚀 Excited to announce our new product! Check it out: https://example.com',
    platforms=['twitter', 'facebook', 'linkedin'],
    media_urls=[image_url],
    scheduled_at=(datetime.now() + timedelta(hours=2)).isoformat(),
    tags=['product-launch', 'announcement'],
    platform_specific={
        'twitter': {'thread': False},
        'facebook': {'privacy': 'PUBLIC'},
        'linkedin': {'visibility': 'PUBLIC'}
    }
)

print(f"Post scheduled with ID: {post['id']}")`,
        description: 'Python post creation with media and scheduling',
        dependencies: ['requests', 'datetime']
      }
    ]
  },
  {
    title: 'Analytics and Reporting',
    description: 'Fetch analytics data and generate reports',
    category: 'Analytics',
    examples: [
      {
        language: 'javascript',
        label: 'JavaScript/Node.js',
        code: `// Analytics API client
class AnalyticsClient {
  constructor(apiClient) {
    this.api = apiClient;
  }
  
  async getWorkspaceAnalytics(workspaceId, options = {}) {
    const params = new URLSearchParams();
    
    // Required parameters
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    
    // Optional parameters
    if (options.platforms) params.append('platforms', options.platforms.join(','));
    if (options.metrics) params.append('metrics', options.metrics.join(','));
    
    try {
      const response = await this.api.get(
        \`/workspaces/\${workspaceId}/analytics?\${params.toString()}\`
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch analytics:', error.response?.data?.message);
      throw error;
    }
  }
  
  async getPostAnalytics(workspaceId, postId) {
    try {
      const response = await this.api.get(
        \`/workspaces/\${workspaceId}/posts/\${postId}/analytics\`
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch post analytics:', error.response?.data?.message);
      throw error;
    }
  }
  
  async generateReport(workspaceId, reportType, options = {}) {
    const reportData = {
      type: reportType,
      startDate: options.startDate,
      endDate: options.endDate,
      platforms: options.platforms || [],
      metrics: options.metrics || [],
      format: options.format || 'json'
    };
    
    try {
      const response = await this.api.post(
        \`/workspaces/\${workspaceId}/reports\`,
        reportData
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to generate report:', error.response?.data?.message);
      throw error;
    }
  }
}

// Usage examples
const analytics = new AnalyticsClient(apiClient);

async function getMonthlyReport() {
  const workspaceId = 'your-workspace-id';
  const startDate = '2024-01-01';
  const endDate = '2024-01-31';
  
  // Get overall analytics
  const analyticsData = await analytics.getWorkspaceAnalytics(workspaceId, {
    startDate,
    endDate,
    platforms: ['twitter', 'facebook', 'linkedin'],
    metrics: ['impressions', 'engagements', 'clicks', 'shares']
  });
  
  console.log('Monthly Analytics:', {
    totalImpressions: analyticsData.metrics.impressions,
    engagementRate: analyticsData.metrics.engagementRate,
    bestPerformingPlatform: analyticsData.breakdown.topPlatform
  });
  
  // Generate PDF report
  const report = await analytics.generateReport(workspaceId, 'monthly', {
    startDate,
    endDate,
    platforms: ['twitter', 'facebook', 'linkedin'],
    format: 'pdf'
  });
  
  console.log('Report generated:', report.downloadUrl);
  return { analyticsData, report };
}`,
        description: 'Fetch analytics and generate reports',
        dependencies: []
      }
    ]
  },
  {
    title: 'Webhook Integration',
    description: 'Set up webhooks to receive real-time notifications',
    category: 'Webhooks',
    examples: [
      {
        language: 'javascript',
        label: 'Node.js Express Server',
        code: `const express = require('express');
const crypto = require('crypto');
const app = express();

// Middleware to verify webhook signature
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-sociallyhub-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.WEBHOOK_SECRET; // Your webhook secret
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    console.log('Invalid webhook signature');
    return res.status(401).send('Unauthorized');
  }
  
  next();
}

app.use(express.json());

// Webhook endpoint
app.post('/webhooks/sociallyhub', verifyWebhookSignature, (req, res) => {
  const { event, data, timestamp } = req.body;
  
  console.log(\`Received webhook: \${event} at \${timestamp}\`);
  
  switch (event) {
    case 'post.published':
      handlePostPublished(data);
      break;
    
    case 'post.failed':
      handlePostFailed(data);
      break;
    
    case 'analytics.updated':
      handleAnalyticsUpdated(data);
      break;
    
    case 'user.invited':
      handleUserInvited(data);
      break;
    
    default:
      console.log(\`Unknown event type: \${event}\`);
  }
  
  // Always respond with 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

function handlePostPublished(data) {
  console.log(\`Post published: \${data.post.title}\`);
  console.log(\`Platforms: \${data.post.platforms.join(', ')}\`);
  
  // Send notification to team
  sendSlackNotification({
    text: \`✅ Post "\${data.post.title}" has been published successfully!\`,
    channel: '#social-media'
  });
}

function handlePostFailed(data) {
  console.error(\`Post failed: \${data.post.title}\`);
  console.error(\`Error: \${data.error.message}\`);
  
  // Alert team about failure
  sendSlackNotification({
    text: \`❌ Post "\${data.post.title}" failed to publish: \${data.error.message}\`,
    channel: '#alerts'
  });
}

function handleAnalyticsUpdated(data) {
  console.log('Analytics data updated');
  
  // Store in database or trigger report generation
  if (data.metrics.engagementRate > 0.05) {
    console.log('🎉 High engagement detected!');
  }
}

function handleUserInvited(data) {
  console.log(\`New user invited: \${data.user.email}\`);
  
  // Send welcome email or setup onboarding
  sendWelcomeEmail(data.user.email);
}

async function sendSlackNotification(message) {
  // Implementation depends on your Slack integration
  console.log('Slack notification:', message.text);
}

async function sendWelcomeEmail(email) {
  // Implementation depends on your email service
  console.log(\`Sending welcome email to \${email}\`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Webhook server listening on port \${PORT}\`);
});

// Register webhook with SociallyHub API
async function registerWebhook() {
  const response = await apiClient.post('/workspaces/your-workspace-id/webhooks', {
    url: 'https://your-server.com/webhooks/sociallyhub',
    events: [
      'post.published',
      'post.failed',
      'analytics.updated',
      'user.invited'
    ]
  });
  
  console.log('Webhook registered:', response.data.data.id);
  
  // Store the webhook secret securely
  process.env.WEBHOOK_SECRET = response.data.data.secret;
}`,
        description: 'Express server to handle webhooks with signature verification',
        dependencies: ['express', 'crypto']
      }
    ]
  }
]

export function CodeExamples({ className = '' }: CodeExamplesProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedLanguage, setSelectedLanguage] = useState('all')

  const categories = ['all', ...Array.from(new Set(integrationExamples.map(e => e.category)))]
  const languages = ['all', ...Array.from(new Set(
    integrationExamples.flatMap(e => e.examples.map(ex => ex.language))
  ))]

  const filteredExamples = integrationExamples.filter(example => {
    if (selectedCategory !== 'all' && example.category !== selectedCategory) {
      return false
    }
    
    if (selectedLanguage !== 'all') {
      return example.examples.some(ex => ex.language === selectedLanguage)
    }
    
    return true
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadCode = (code: string, filename: string) => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getLanguageExtension = (language: string) => {
    const extensions: Record<string, string> = {
      javascript: 'js',
      python: 'py',
      php: 'php',
      curl: 'sh',
      java: 'java',
      csharp: 'cs'
    }
    return extensions[language] || 'txt'
  }

  const getLanguageIcon = (language: string) => {
    switch (language) {
      case 'javascript':
        return <Code className="h-4 w-4 text-yellow-600" />
      case 'python':
        return <Code className="h-4 w-4 text-blue-600" />
      case 'php':
        return <Code className="h-4 w-4 text-purple-600" />
      case 'curl':
        return <Terminal className="h-4 w-4 text-green-600" />
      default:
        return <Code className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Code Examples</h1>
          <p className="text-muted-foreground">
            Ready-to-use code examples for integrating with the SociallyHub API
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(language => (
                    <SelectItem key={language} value={language}>
                      {language === 'all' ? 'All Languages' : language.charAt(0).toUpperCase() + language.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <div className="space-y-8">
        {filteredExamples.map((example, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{example.title}</CardTitle>
                  <p className="text-muted-foreground mt-1">{example.description}</p>
                </div>
                <Badge variant="outline">{example.category}</Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="0" className="w-full">
                <TabsList className="grid w-full grid-cols-1 lg:grid-cols-3 mb-4">
                  {example.examples
                    .filter(ex => selectedLanguage === 'all' || ex.language === selectedLanguage)
                    .map((ex, exIndex) => (
                    <TabsTrigger key={exIndex} value={exIndex.toString()}>
                      <div className="flex items-center space-x-2">
                        {getLanguageIcon(ex.language)}
                        <span>{ex.label}</span>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {example.examples
                  .filter(ex => selectedLanguage === 'all' || ex.language === selectedLanguage)
                  .map((ex, exIndex) => (
                  <TabsContent key={exIndex} value={exIndex.toString()}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold flex items-center space-x-2">
                            {getLanguageIcon(ex.language)}
                            <span>{ex.label}</span>
                          </h4>
                          <p className="text-sm text-muted-foreground">{ex.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(ex.code)}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadCode(
                              ex.code,
                              \`sociallyhub-example.\${getLanguageExtension(ex.language)}\`
                            )}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      
                      {ex.dependencies && ex.dependencies.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">Dependencies:</h5>
                          <div className="flex flex-wrap gap-2">
                            {ex.dependencies.map(dep => (
                              <Badge key={dep} variant="secondary" className="text-xs">
                                {dep}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto max-h-96 scrollbar-thin">
                          <code>{ex.code}</code>
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
          <p className="text-muted-foreground">
            Get up and running with the SociallyHub API in minutes
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <h4 className="font-semibold">Get API Credentials</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Sign up for a SociallyHub account and generate your API keys from the dashboard.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <h4 className="font-semibold">Make Your First Call</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Use the authentication examples above to login and get your access token.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <h4 className="font-semibold">Start Building</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Use our comprehensive examples to build your social media management solution.
              </p>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-center space-x-4">
            <Button>
              <Globe className="h-4 w-4 mr-2" />
              View Full Documentation
            </Button>
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              API Reference
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}