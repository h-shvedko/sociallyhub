import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const documentationSections = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    description: 'Quick start guides and basic setup instructions',
    icon: 'Zap',
    sortOrder: 0
  },
  {
    title: 'API Reference',
    slug: 'api-reference',
    description: 'Complete API documentation with examples',
    icon: 'Code',
    sortOrder: 1
  },
  {
    title: 'Integrations',
    slug: 'integrations',
    description: 'Third-party integrations and webhooks',
    icon: 'Plug',
    sortOrder: 2
  },
  {
    title: 'Features Guide',
    slug: 'features-guide',
    description: 'Detailed feature documentation and tutorials',
    icon: 'Book',
    sortOrder: 3
  }
]

const documentationPages = [
  // Getting Started Section
  {
    title: 'Quick Start Guide',
    slug: 'quick-start-guide',
    content: `
      <h2>Welcome to SociallyHub</h2>
      <p>This guide will help you get started with SociallyHub in just a few minutes.</p>

      <h3>Step 1: Create Your Workspace</h3>
      <p>After signing up, you'll be prompted to create your first workspace. A workspace is your organization's hub for managing social media accounts and content.</p>

      <h3>Step 2: Connect Social Media Accounts</h3>
      <p>Navigate to <strong>Settings > Social Accounts</strong> and connect your social media platforms:</p>
      <ul>
        <li>Facebook Pages and Groups</li>
        <li>Twitter/X Accounts</li>
        <li>Instagram Business Accounts</li>
        <li>LinkedIn Pages</li>
        <li>YouTube Channels</li>
        <li>TikTok Business Accounts</li>
      </ul>

      <h3>Step 3: Invite Team Members</h3>
      <p>Go to <strong>Settings > Team</strong> to invite colleagues and assign appropriate roles:</p>
      <ul>
        <li><strong>Owner</strong> - Full access to all features</li>
        <li><strong>Admin</strong> - Manage content and team members</li>
        <li><strong>Publisher</strong> - Create and publish content</li>
        <li><strong>Analyst</strong> - View analytics and reports</li>
      </ul>

      <h3>Step 4: Create Your First Post</h3>
      <p>Ready to publish? Head to <strong>Content > Create Post</strong> and start crafting your content. You can:</p>
      <ul>
        <li>Write text posts with rich formatting</li>
        <li>Upload images and videos</li>
        <li>Schedule posts for optimal timing</li>
        <li>Create platform-specific variants</li>
      </ul>

      <h3>Next Steps</h3>
      <p>Explore our comprehensive features:</p>
      <ul>
        <li><a href="/dashboard/documentation/content-management">Content Management</a></li>
        <li><a href="/dashboard/documentation/analytics-dashboard">Analytics Dashboard</a></li>
        <li><a href="/dashboard/documentation/automation-features">Automation Features</a></li>
      </ul>
    `,
    excerpt: 'Get up and running with SociallyHub in minutes with this comprehensive quick start guide.',
    sectionSlug: 'getting-started',
    tags: ['setup', 'quickstart', 'beginner'],
    estimatedReadTime: 5,
    views: 1250,
    helpfulVotes: 89
  },
  {
    title: 'Installation & Setup',
    slug: 'installation-setup',
    content: `
      <h2>Installation & Setup</h2>
      <p>This guide covers the technical setup process for SociallyHub.</p>

      <h3>System Requirements</h3>
      <ul>
        <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
        <li>Stable internet connection</li>
        <li>Administrative access to social media accounts</li>
      </ul>

      <h3>Account Setup</h3>
      <p>Follow these steps to set up your SociallyHub account:</p>

      <h4>1. Sign Up</h4>
      <p>Visit <a href="https://app.sociallyhub.com/signup">app.sociallyhub.com/signup</a> and create your account.</p>

      <h4>2. Email Verification</h4>
      <p>Check your email for a verification link and click it to activate your account.</p>

      <h4>3. Workspace Creation</h4>
      <p>Create your workspace by providing:</p>
      <ul>
        <li>Organization name</li>
        <li>Industry type</li>
        <li>Team size</li>
        <li>Primary use case</li>
      </ul>

      <h3>Security Setup</h3>
      <p>Enhance your account security:</p>

      <h4>Two-Factor Authentication</h4>
      <p>Enable 2FA in <strong>Settings > Security</strong> for additional protection.</p>

      <h4>API Keys</h4>
      <p>Generate API keys in <strong>Settings > Integrations > API Keys</strong> for programmatic access.</p>

      <h3>Troubleshooting</h3>
      <p>Common setup issues and solutions:</p>

      <h4>Email Verification Issues</h4>
      <ul>
        <li>Check spam/junk folder</li>
        <li>Request new verification email</li>
        <li>Contact support if issues persist</li>
      </ul>

      <h4>Social Account Connection Problems</h4>
      <ul>
        <li>Ensure you have admin rights to the account</li>
        <li>Clear browser cache and cookies</li>
        <li>Try using an incognito/private browser window</li>
      </ul>
    `,
    excerpt: 'Complete installation and setup guide for getting SociallyHub configured properly.',
    sectionSlug: 'getting-started',
    tags: ['installation', 'setup', 'configuration'],
    estimatedReadTime: 8,
    views: 890,
    helpfulVotes: 67
  },

  // API Reference Section
  {
    title: 'Authentication',
    slug: 'api-authentication',
    content: `
      <h2>API Authentication</h2>
      <p>SociallyHub API uses Bearer token authentication for secure access to your data.</p>

      <h3>Getting Your API Key</h3>
      <p>To get your API key:</p>
      <ol>
        <li>Navigate to <strong>Settings > Integrations > API Keys</strong></li>
        <li>Click <strong>Generate New Key</strong></li>
        <li>Copy and securely store your API key</li>
      </ol>

      <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <strong>⚠️ Security Note:</strong> Never expose your API key in client-side code or public repositories.
      </div>

      <h3>Making Authenticated Requests</h3>
      <p>Include your API key in the Authorization header:</p>

      <pre><code>curl -H "Authorization: Bearer YOUR_API_KEY" \\
     https://api.sociallyhub.com/v1/posts</code></pre>

      <h3>Authentication Endpoints</h3>

      <h4>Verify Token</h4>
      <p><code>GET /api/v1/auth/verify</code></p>
      <p>Verify that your API key is valid and get basic account information.</p>

      <pre><code>{
  "valid": true,
  "workspace": {
    "id": "ws_1234567890",
    "name": "Acme Corporation",
    "plan": "pro"
  },
  "permissions": ["read:posts", "write:posts", "read:analytics"]
}</code></pre>

      <h4>Refresh Token</h4>
      <p><code>POST /api/v1/auth/refresh</code></p>
      <p>Refresh your API token if it's close to expiration.</p>

      <h3>Error Responses</h3>
      <p>Authentication errors return appropriate HTTP status codes:</p>

      <ul>
        <li><code>401 Unauthorized</code> - Invalid or missing API key</li>
        <li><code>403 Forbidden</code> - Insufficient permissions</li>
        <li><code>429 Too Many Requests</code> - Rate limit exceeded</li>
      </ul>

      <h3>Rate Limiting</h3>
      <p>API requests are limited to:</p>
      <ul>
        <li><strong>Free Plan:</strong> 100 requests/hour</li>
        <li><strong>Pro Plan:</strong> 1,000 requests/hour</li>
        <li><strong>Enterprise:</strong> 10,000 requests/hour</li>
      </ul>

      <p>Rate limit headers are included in responses:</p>
      <pre><code>X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200</code></pre>
    `,
    excerpt: 'Learn how to authenticate with the SociallyHub API using Bearer tokens and API keys.',
    sectionSlug: 'api-reference',
    tags: ['api', 'authentication', 'security'],
    estimatedReadTime: 6,
    views: 1450,
    helpfulVotes: 124
  },
  {
    title: 'Posts API',
    slug: 'posts-api',
    content: `
      <h2>Posts API</h2>
      <p>The Posts API allows you to create, read, update, and delete social media posts programmatically.</p>

      <h3>Base URL</h3>
      <p><code>https://api.sociallyhub.com/v1/posts</code></p>

      <h3>List Posts</h3>
      <p><code>GET /api/v1/posts</code></p>
      <p>Retrieve a list of posts for your workspace.</p>

      <h4>Query Parameters</h4>
      <ul>
        <li><code>limit</code> (integer, optional) - Number of posts to return (default: 20, max: 100)</li>
        <li><code>offset</code> (integer, optional) - Number of posts to skip (default: 0)</li>
        <li><code>status</code> (string, optional) - Filter by status: draft, scheduled, published, failed</li>
        <li><code>platform</code> (string, optional) - Filter by platform: facebook, twitter, instagram, etc.</li>
        <li><code>from_date</code> (string, optional) - Filter posts from date (ISO 8601 format)</li>
        <li><code>to_date</code> (string, optional) - Filter posts to date (ISO 8601 format)</li>
      </ul>

      <h4>Example Request</h4>
      <pre><code>curl -H "Authorization: Bearer YOUR_API_KEY" \\
     "https://api.sociallyhub.com/v1/posts?limit=10&status=published"</code></pre>

      <h4>Example Response</h4>
      <pre><code>{
  "posts": [
    {
      "id": "post_1234567890",
      "content": "Check out our latest product update!",
      "status": "published",
      "scheduled_at": "2024-01-15T10:00:00Z",
      "published_at": "2024-01-15T10:00:00Z",
      "platforms": ["facebook", "twitter"],
      "media": [
        {
          "type": "image",
          "url": "https://cdn.sociallyhub.com/image.jpg",
          "alt_text": "Product screenshot"
        }
      ],
      "analytics": {
        "views": 1250,
        "engagements": 89,
        "clicks": 23
      },
      "created_at": "2024-01-15T09:30:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}</code></pre>

      <h3>Create Post</h3>
      <p><code>POST /api/v1/posts</code></p>
      <p>Create a new social media post.</p>

      <h4>Request Body</h4>
      <pre><code>{
  "content": "Your post content here",
  "platforms": ["facebook", "twitter"],
  "scheduled_at": "2024-01-20T14:30:00Z",
  "media": [
    {
      "type": "image",
      "url": "https://your-domain.com/image.jpg",
      "alt_text": "Description of the image"
    }
  ],
  "platform_variants": {
    "twitter": {
      "content": "Shorter content for Twitter"
    }
  }
}</code></pre>

      <h4>Response</h4>
      <pre><code>{
  "id": "post_1234567890",
  "status": "scheduled",
  "message": "Post created successfully"
}</code></pre>

      <h3>Get Single Post</h3>
      <p><code>GET /api/v1/posts/{post_id}</code></p>
      <p>Retrieve detailed information about a specific post.</p>

      <h3>Update Post</h3>
      <p><code>PUT /api/v1/posts/{post_id}</code></p>
      <p>Update an existing post. Only draft and scheduled posts can be updated.</p>

      <h3>Delete Post</h3>
      <p><code>DELETE /api/v1/posts/{post_id}</code></p>
      <p>Delete a post. Only draft and scheduled posts can be deleted.</p>

      <h3>Error Responses</h3>
      <ul>
        <li><code>400 Bad Request</code> - Invalid request data</li>
        <li><code>404 Not Found</code> - Post not found</li>
        <li><code>422 Unprocessable Entity</code> - Validation errors</li>
      </ul>
    `,
    excerpt: 'Complete API reference for managing social media posts, including creation, updates, and deletion.',
    sectionSlug: 'api-reference',
    tags: ['api', 'posts', 'endpoints'],
    estimatedReadTime: 10,
    views: 2100,
    helpfulVotes: 156
  },

  // Integrations Section
  {
    title: 'Webhook Configuration',
    slug: 'webhook-configuration',
    content: `
      <h2>Webhook Configuration</h2>
      <p>Webhooks allow SociallyHub to send real-time notifications to your application when specific events occur.</p>

      <h3>Setting Up Webhooks</h3>
      <p>Configure webhooks in your workspace settings:</p>
      <ol>
        <li>Go to <strong>Settings > Integrations > Webhooks</strong></li>
        <li>Click <strong>Add Webhook</strong></li>
        <li>Enter your endpoint URL</li>
        <li>Select the events you want to receive</li>
        <li>Configure retry and timeout settings</li>
      </ol>

      <h3>Supported Events</h3>
      <p>SociallyHub can send webhooks for the following events:</p>

      <h4>Post Events</h4>
      <ul>
        <li><code>post.published</code> - Post successfully published</li>
        <li><code>post.failed</code> - Post failed to publish</li>
        <li><code>post.scheduled</code> - Post scheduled for later</li>
        <li><code>post.updated</code> - Post content updated</li>
        <li><code>post.deleted</code> - Post deleted</li>
      </ul>

      <h4>Analytics Events</h4>
      <ul>
        <li><code>analytics.report_ready</code> - Scheduled report is ready</li>
        <li><code>analytics.threshold_reached</code> - Metric threshold reached</li>
      </ul>

      <h4>Account Events</h4>
      <ul>
        <li><code>account.connected</code> - Social account connected</li>
        <li><code>account.disconnected</code> - Social account disconnected</li>
        <li><code>account.token_expired</code> - Account token needs refresh</li>
      </ul>

      <h3>Webhook Payload</h3>
      <p>All webhooks include a standard payload structure:</p>

      <pre><code>{
  "event": "post.published",
  "timestamp": "2024-01-15T10:30:00Z",
  "workspace_id": "ws_1234567890",
  "data": {
    "post_id": "post_1234567890",
    "content": "Post content here",
    "platforms": ["facebook", "twitter"],
    "published_at": "2024-01-15T10:30:00Z",
    "analytics": {
      "initial_reach": 1250
    }
  }
}</code></pre>

      <h3>Security</h3>
      <p>Webhook security is ensured through HMAC signature verification:</p>

      <h4>Signature Verification</h4>
      <p>Each webhook includes an <code>X-Signature</code> header with an HMAC-SHA256 signature.</p>

      <pre><code>const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return \`sha256=\${expectedSignature}\` === signature;
}</code></pre>

      <h3>Retry Logic</h3>
      <p>Webhook delivery includes automatic retry logic:</p>
      <ul>
        <li><strong>Retry Attempts:</strong> Up to 5 attempts</li>
        <li><strong>Retry Schedule:</strong> 30s, 2m, 10m, 1h, 6h</li>
        <li><strong>Success Criteria:</strong> HTTP 200-299 response</li>
        <li><strong>Timeout:</strong> 30 seconds per attempt</li>
      </ul>

      <h3>Testing Webhooks</h3>
      <p>Use the webhook testing tool in your dashboard:</p>
      <ol>
        <li>Go to your webhook configuration</li>
        <li>Click <strong>Test Webhook</strong></li>
        <li>Select an event type</li>
        <li>Send a test payload to your endpoint</li>
      </ol>

      <h3>Monitoring</h3>
      <p>Monitor webhook delivery in the dashboard:</p>
      <ul>
        <li>View delivery attempts and responses</li>
        <li>Check error logs and failure reasons</li>
        <li>Monitor delivery success rates</li>
        <li>Set up alerts for failed deliveries</li>
      </ul>
    `,
    excerpt: 'Configure webhooks to receive real-time notifications about events in your SociallyHub workspace.',
    sectionSlug: 'integrations',
    tags: ['webhooks', 'integrations', 'events'],
    estimatedReadTime: 8,
    views: 890,
    helpfulVotes: 78
  },

  // Features Guide Section
  {
    title: 'Content Management',
    slug: 'content-management',
    content: `
      <h2>Content Management</h2>
      <p>SociallyHub's content management system helps you create, organize, and publish content across multiple social media platforms.</p>

      <h3>Creating Content</h3>
      <p>Start creating content from the Content dashboard:</p>

      <h4>Text Posts</h4>
      <ul>
        <li>Rich text editor with formatting options</li>
        <li>Hashtag suggestions and management</li>
        <li>Mention suggestions for team collaboration</li>
        <li>Character count for each platform</li>
        <li>Link preview and shortening</li>
      </ul>

      <h4>Media Posts</h4>
      <ul>
        <li>Upload images (JPG, PNG, GIF up to 10MB)</li>
        <li>Upload videos (MP4, MOV up to 100MB)</li>
        <li>Automatic image optimization</li>
        <li>Alt text for accessibility</li>
        <li>Multiple media per post</li>
      </ul>

      <h3>Platform Optimization</h3>
      <p>Create platform-specific variations of your content:</p>

      <h4>Platform Variants</h4>
      <p>Customize content for each platform's best practices:</p>
      <ul>
        <li><strong>Twitter/X:</strong> Optimal character limits, hashtag placement</li>
        <li><strong>Facebook:</strong> Longer-form content, engaging captions</li>
        <li><strong>Instagram:</strong> Visual-first content, story formatting</li>
        <li><strong>LinkedIn:</strong> Professional tone, industry insights</li>
      </ul>

      <h4>Auto-Optimization</h4>
      <p>Let SociallyHub automatically optimize your content:</p>
      <ul>
        <li>Image resizing for platform requirements</li>
        <li>Video compression and format conversion</li>
        <li>Hashtag suggestions based on content analysis</li>
        <li>Optimal posting time recommendations</li>
      </ul>

      <h3>Content Organization</h3>

      <h4>Content Categories</h4>
      <p>Organize your content with custom categories:</p>
      <ul>
        <li>Create custom categories for your content types</li>
        <li>Filter and search content by category</li>
        <li>Set category-specific templates</li>
        <li>Track performance by category</li>
      </ul>

      <h4>Content Calendar</h4>
      <p>Visualize your content schedule:</p>
      <ul>
        <li>Drag-and-drop scheduling interface</li>
        <li>Monthly, weekly, and daily views</li>
        <li>Color-coded content types</li>
        <li>Team collaboration on calendar</li>
      </ul>

      <h3>Content Templates</h3>
      <p>Save time with reusable content templates:</p>

      <h4>Creating Templates</h4>
      <ol>
        <li>Create a post with your desired format</li>
        <li>Click <strong>Save as Template</strong></li>
        <li>Name your template and add description</li>
        <li>Set template variables for customization</li>
      </ol>

      <h4>Template Variables</h4>
      <p>Use variables to create dynamic templates:</p>
      <ul>
        <li><code>{{product_name}}</code> - Product or service name</li>
        <li><code>{{date}}</code> - Current date</li>
        <li><code>{{author}}</code> - Content creator name</li>
        <li><code>{{custom_field}}</code> - Custom variables</li>
      </ul>

      <h3>Content Approval Workflow</h3>
      <p>Set up approval processes for team content:</p>

      <h4>Approval Roles</h4>
      <ul>
        <li><strong>Creator:</strong> Draft and submit content</li>
        <li><strong>Reviewer:</strong> Review and request changes</li>
        <li><strong>Approver:</strong> Final approval for publishing</li>
      </ul>

      <h4>Approval Process</h4>
      <ol>
        <li>Creator submits content for review</li>
        <li>Reviewer checks content and provides feedback</li>
        <li>Creator makes necessary revisions</li>
        <li>Approver gives final approval</li>
        <li>Content is scheduled or published</li>
      </ol>

      <h3>Content Performance</h3>
      <p>Track how your content performs:</p>

      <ul>
        <li>Real-time engagement metrics</li>
        <li>Content performance comparison</li>
        <li>Best performing content analysis</li>
        <li>Audience engagement insights</li>
      </ul>
    `,
    excerpt: 'Master SociallyHub\'s content management features including creation, organization, and optimization.',
    sectionSlug: 'features-guide',
    tags: ['content', 'management', 'publishing'],
    estimatedReadTime: 12,
    views: 1850,
    helpfulVotes: 142
  },
  {
    title: 'Analytics Dashboard',
    slug: 'analytics-dashboard',
    content: `
      <h2>Analytics Dashboard</h2>
      <p>Get comprehensive insights into your social media performance with SociallyHub's advanced analytics dashboard.</p>

      <h3>Dashboard Overview</h3>
      <p>The analytics dashboard provides a comprehensive view of your social media performance across all connected platforms.</p>

      <h4>Key Metrics</h4>
      <ul>
        <li><strong>Reach:</strong> Total number of unique users who saw your content</li>
        <li><strong>Impressions:</strong> Total number of times your content was displayed</li>
        <li><strong>Engagement:</strong> Likes, comments, shares, and other interactions</li>
        <li><strong>Click-through Rate:</strong> Percentage of people who clicked your links</li>
        <li><strong>Conversion Rate:</strong> Percentage of clicks that resulted in desired actions</li>
      </ul>

      <h3>Platform-Specific Analytics</h3>

      <h4>Facebook Analytics</h4>
      <ul>
        <li>Page insights and audience demographics</li>
        <li>Post performance and engagement rates</li>
        <li>Video view duration and completion rates</li>
        <li>Story insights and reach metrics</li>
      </ul>

      <h4>Instagram Analytics</h4>
      <ul>
        <li>Account insights and follower growth</li>
        <li>Content performance (posts, stories, reels)</li>
        <li>Hashtag performance analysis</li>
        <li>Audience activity patterns</li>
      </ul>

      <h4>Twitter/X Analytics</h4>
      <ul>
        <li>Tweet impressions and engagement</li>
        <li>Follower growth and demographics</li>
        <li>Top performing tweets analysis</li>
        <li>Mention and hashtag tracking</li>
      </ul>

      <h4>LinkedIn Analytics</h4>
      <ul>
        <li>Page and post performance metrics</li>
        <li>Professional audience insights</li>
        <li>Company update analytics</li>
        <li>Employee advocacy tracking</li>
      </ul>

      <h3>Custom Reports</h3>
      <p>Create custom reports tailored to your specific needs:</p>

      <h4>Report Builder</h4>
      <ol>
        <li>Go to <strong>Analytics > Custom Reports</strong></li>
        <li>Select metrics and dimensions</li>
        <li>Choose date range and filters</li>
        <li>Customize visualization options</li>
        <li>Save and schedule the report</li>
      </ol>

      <h4>Available Metrics</h4>
      <ul>
        <li>Engagement metrics (likes, comments, shares)</li>
        <li>Reach and impression data</li>
        <li>Click-through and conversion rates</li>
        <li>Audience growth and demographics</li>
        <li>Content performance comparisons</li>
      </ul>

      <h3>Automated Reporting</h3>
      <p>Set up automated reports to stay informed:</p>

      <h4>Report Scheduling</h4>
      <ul>
        <li><strong>Frequency:</strong> Daily, weekly, monthly, or quarterly</li>
        <li><strong>Delivery:</strong> Email, Slack, or dashboard notifications</li>
        <li><strong>Recipients:</strong> Team members and stakeholders</li>
        <li><strong>Format:</strong> PDF, Excel, or online dashboard</li>
      </ul>

      <h4>Report Templates</h4>
      <ul>
        <li><strong>Executive Summary:</strong> High-level KPIs for leadership</li>
        <li><strong>Content Performance:</strong> Detailed content analysis</li>
        <li><strong>Audience Insights:</strong> Demographic and behavior data</li>
        <li><strong>Competitive Analysis:</strong> Benchmarking against competitors</li>
      </ul>

      <h3>Real-Time Monitoring</h3>
      <p>Monitor your social media performance in real-time:</p>

      <h4>Live Dashboard</h4>
      <ul>
        <li>Real-time engagement tracking</li>
        <li>Live post performance monitoring</li>
        <li>Instant notification for viral content</li>
        <li>Crisis monitoring and alerts</li>
      </ul>

      <h4>Alerts and Notifications</h4>
      <p>Set up alerts for important events:</p>
      <ul>
        <li>High engagement rate threshold</li>
        <li>Unusual activity patterns</li>
        <li>Negative sentiment detection</li>
        <li>Competitor activity monitoring</li>
      </ul>

      <h3>Data Export</h3>
      <p>Export your analytics data for external analysis:</p>

      <h4>Export Options</h4>
      <ul>
        <li><strong>CSV:</strong> Raw data for spreadsheet analysis</li>
        <li><strong>Excel:</strong> Formatted reports with charts</li>
        <li><strong>PDF:</strong> Professional presentation-ready reports</li>
        <li><strong>JSON:</strong> Structured data for API integration</li>
      </ul>

      <h4>API Access</h4>
      <p>Access analytics data programmatically:</p>
      <ul>
        <li>RESTful API with comprehensive endpoints</li>
        <li>Real-time data streaming</li>
        <li>Custom dashboard integration</li>
        <li>Third-party tool connections</li>
      </ul>

      <h3>Performance Optimization</h3>
      <p>Use analytics insights to optimize your strategy:</p>

      <ul>
        <li><strong>Best Time to Post:</strong> Optimal posting schedule analysis</li>
        <li><strong>Content Type Performance:</strong> Which formats work best</li>
        <li><strong>Hashtag Effectiveness:</strong> Most engaging hashtags</li>
        <li><strong>Audience Insights:</strong> Understanding your audience behavior</li>
      </ul>
    `,
    excerpt: 'Comprehensive guide to using SociallyHub\'s analytics dashboard for data-driven social media insights.',
    sectionSlug: 'features-guide',
    tags: ['analytics', 'reporting', 'insights'],
    estimatedReadTime: 15,
    views: 2340,
    helpfulVotes: 189
  }
]

async function seedDocumentation() {
  console.log('Seeding documentation...')

  try {
    // Create sections first
    for (const sectionData of documentationSections) {
      await prisma.documentationSection.upsert({
        where: { slug: sectionData.slug },
        update: sectionData,
        create: sectionData
      })
      console.log(`✓ Created/updated section: ${sectionData.title}`)
    }

    // Create pages
    for (const pageData of documentationPages) {
      const { sectionSlug, ...pageWithoutSectionSlug } = pageData

      // Find section by slug
      const section = await prisma.documentationSection.findUnique({
        where: { slug: sectionSlug }
      })

      if (!section) {
        console.error(`❌ Section not found for slug: ${sectionSlug}`)
        continue
      }

      await prisma.documentationPage.upsert({
        where: { slug: pageData.slug },
        update: {
          ...pageWithoutSectionSlug,
          sectionId: section.id,
          publishedAt: new Date()
        },
        create: {
          ...pageWithoutSectionSlug,
          sectionId: section.id,
          publishedAt: new Date()
        }
      })
      console.log(`✓ Created/updated page: ${pageData.title}`)
    }

    console.log('✅ Documentation seeding completed successfully!')

  } catch (error) {
    console.error('❌ Error seeding documentation:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed function
seedDocumentation()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })