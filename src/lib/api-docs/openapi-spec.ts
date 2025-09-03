import { OpenAPIV3 } from 'openapi-types'

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'SociallyHub API',
    version: '1.0.0',
    description: 'Comprehensive social media management platform API',
    termsOfService: 'https://sociallyhub.com/terms',
    contact: {
      name: 'SociallyHub Support',
      url: 'https://sociallyhub.com/support',
      email: 'api@sociallyhub.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'https://api.sociallyhub.com/v1',
      description: 'Production server'
    },
    {
      url: 'https://staging-api.sociallyhub.com/v1',
      description: 'Staging server'
    },
    {
      url: 'http://localhost:3099/api/v1',
      description: 'Development server'
    }
  ],
  security: [
    {
      BearerAuth: []
    },
    {
      ApiKeyAuth: []
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authenticated requests'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for server-to-server authentication'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          name: {
            type: 'string',
            description: 'Full name'
          },
          avatar: {
            type: 'string',
            format: 'uri',
            description: 'Profile picture URL'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['id', 'email', 'name', 'createdAt', 'updatedAt']
      },
      Workspace: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique workspace identifier'
          },
          name: {
            type: 'string',
            description: 'Workspace name'
          },
          description: {
            type: 'string',
            description: 'Workspace description'
          },
          logo: {
            type: 'string',
            format: 'uri',
            description: 'Workspace logo URL'
          },
          plan: {
            type: 'string',
            enum: ['free', 'pro', 'business', 'enterprise'],
            description: 'Subscription plan'
          },
          settings: {
            type: 'object',
            description: 'Workspace configuration settings'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['id', 'name', 'plan', 'createdAt', 'updatedAt']
      },
      SocialAccount: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          platform: {
            type: 'string',
            enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest'],
            description: 'Social media platform'
          },
          username: {
            type: 'string',
            description: 'Account username/handle'
          },
          displayName: {
            type: 'string',
            description: 'Display name'
          },
          profilePicture: {
            type: 'string',
            format: 'uri'
          },
          followerCount: {
            type: 'integer',
            description: 'Number of followers'
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'error', 'pending'],
            description: 'Account connection status'
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Granted permissions'
          },
          connectedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['id', 'platform', 'username', 'status', 'connectedAt']
      },
      Post: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          title: {
            type: 'string',
            description: 'Post title (internal)'
          },
          content: {
            type: 'string',
            description: 'Post content/text'
          },
          mediaUrls: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri'
            },
            description: 'Attached media URLs'
          },
          platforms: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Target social platforms'
          },
          status: {
            type: 'string',
            enum: ['draft', 'scheduled', 'published', 'failed', 'cancelled'],
            description: 'Post status'
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            description: 'Scheduled publication time'
          },
          publishedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Actual publication time'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Post tags/categories'
          },
          analytics: {
            type: 'object',
            description: 'Post performance metrics'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['id', 'content', 'platforms', 'status', 'createdAt', 'updatedAt']
      },
      Campaign: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            description: 'Campaign name'
          },
          description: {
            type: 'string',
            description: 'Campaign description'
          },
          type: {
            type: 'string',
            enum: ['brand_awareness', 'lead_generation', 'sales', 'engagement', 'traffic'],
            description: 'Campaign type/objective'
          },
          status: {
            type: 'string',
            enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
            description: 'Campaign status'
          },
          budget: {
            type: 'number',
            description: 'Campaign budget'
          },
          startDate: {
            type: 'string',
            format: 'date-time'
          },
          endDate: {
            type: 'string',
            format: 'date-time'
          },
          platforms: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          metrics: {
            type: 'object',
            description: 'Campaign performance metrics'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['id', 'name', 'type', 'status', 'createdAt', 'updatedAt']
      },
      Analytics: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description: 'Time period for metrics'
          },
          metrics: {
            type: 'object',
            properties: {
              impressions: {
                type: 'integer',
                description: 'Total impressions'
              },
              engagements: {
                type: 'integer',
                description: 'Total engagements'
              },
              clicks: {
                type: 'integer',
                description: 'Total clicks'
              },
              shares: {
                type: 'integer',
                description: 'Total shares'
              },
              comments: {
                type: 'integer',
                description: 'Total comments'
              },
              likes: {
                type: 'integer',
                description: 'Total likes'
              },
              reach: {
                type: 'integer',
                description: 'Unique reach'
              },
              engagementRate: {
                type: 'number',
                format: 'float',
                description: 'Engagement rate percentage'
              }
            }
          },
          breakdown: {
            type: 'object',
            description: 'Metrics breakdown by platform/time'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type'
          },
          message: {
            type: 'string',
            description: 'Human-readable error message'
          },
          details: {
            type: 'object',
            description: 'Additional error context'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          },
          requestId: {
            type: 'string',
            description: 'Unique request identifier'
          }
        },
        required: ['error', 'message', 'timestamp']
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {},
            description: 'Array of results'
          },
          pagination: {
            type: 'object',
            properties: {
              page: {
                type: 'integer',
                description: 'Current page number'
              },
              limit: {
                type: 'integer',
                description: 'Items per page'
              },
              total: {
                type: 'integer',
                description: 'Total number of items'
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages'
              },
              hasNext: {
                type: 'boolean',
                description: 'Whether there are more pages'
              },
              hasPrev: {
                type: 'boolean',
                description: 'Whether there are previous pages'
              }
            }
          }
        }
      },
      Webhook: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Webhook endpoint URL'
          },
          events: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Subscribed event types'
          },
          secret: {
            type: 'string',
            description: 'Webhook signing secret'
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'failed'],
            description: 'Webhook status'
          },
          lastDelivery: {
            type: 'string',
            format: 'date-time',
            description: 'Last successful delivery'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['id', 'url', 'events', 'status', 'createdAt']
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              error: 'unauthorized',
              message: 'Authentication required. Please provide a valid API key or JWT token.',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_12345'
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              error: 'forbidden',
              message: 'Insufficient permissions to access this resource.',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_12346'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              error: 'not_found',
              message: 'The requested resource was not found.',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_12347'
            }
          }
        }
      },
      ValidationError: {
        description: 'Invalid request data',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              error: 'validation_error',
              message: 'Request validation failed.',
              details: {
                fields: {
                  email: ['Email is required', 'Email format is invalid'],
                  name: ['Name must be at least 2 characters']
                }
              },
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_12348'
            }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              error: 'rate_limit_exceeded',
              message: 'API rate limit exceeded. Please try again later.',
              details: {
                limit: 1000,
                remaining: 0,
                resetTime: '2024-01-15T11:00:00Z'
              },
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_12349'
            }
          }
        }
      }
    },
    parameters: {
      WorkspaceId: {
        name: 'workspaceId',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        },
        description: 'Workspace identifier'
      },
      Page: {
        name: 'page',
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        description: 'Page number for pagination'
      },
      Limit: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        },
        description: 'Number of items per page'
      },
      Sort: {
        name: 'sort',
        in: 'query',
        required: false,
        schema: {
          type: 'string'
        },
        description: 'Sort field (prefix with - for descending order)'
      }
    }
  },
  paths: {},
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Users',
      description: 'User account management'
    },
    {
      name: 'Workspaces',
      description: 'Workspace and team management'
    },
    {
      name: 'Social Accounts',
      description: 'Social media account connections'
    },
    {
      name: 'Posts',
      description: 'Content creation and publishing'
    },
    {
      name: 'Campaigns',
      description: 'Campaign management and tracking'
    },
    {
      name: 'Analytics',
      description: 'Performance metrics and reporting'
    },
    {
      name: 'Webhooks',
      description: 'Event notifications and webhooks'
    }
  ]
}

export default openApiSpec