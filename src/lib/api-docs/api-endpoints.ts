import { OpenAPIV3 } from 'openapi-types'
import authEndpoints from './auth-endpoints'

export const apiEndpoints: Record<string, OpenAPIV3.PathItemObject> = {
  ...authEndpoints,
  
  // Users Endpoints
  '/users/{userId}': {
    get: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Retrieve user information by ID',
      operationId: 'getUserById',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'User ID'
        }
      ],
      responses: {
        '200': {
          description: 'User information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '404': { $ref: '#/components/responses/NotFoundError' }
      }
    },
    patch: {
      tags: ['Users'],
      summary: 'Update user profile',
      description: 'Update user profile information',
      operationId: 'updateUser',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 2, maxLength: 100 },
                avatar: { type: 'string', format: 'uri' },
                timezone: { type: 'string' },
                preferences: { type: 'object' }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'User updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '404': { $ref: '#/components/responses/NotFoundError' }
      }
    }
  },

  // Workspaces Endpoints
  '/workspaces': {
    get: {
      tags: ['Workspaces'],
      summary: 'List user workspaces',
      description: 'Get all workspaces for the authenticated user',
      operationId: 'listWorkspaces',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Limit' }
      ],
      responses: {
        '200': {
          description: 'List of workspaces',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/PaginatedResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Workspace' }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' }
      }
    },
    post: {
      tags: ['Workspaces'],
      summary: 'Create workspace',
      description: 'Create a new workspace',
      operationId: 'createWorkspace',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 2, maxLength: 50 },
                description: { type: 'string', maxLength: 200 },
                plan: { 
                  type: 'string', 
                  enum: ['free', 'pro', 'business', 'enterprise'],
                  default: 'free'
                }
              },
              required: ['name']
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Workspace created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Workspace' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' }
      }
    }
  },

  '/workspaces/{workspaceId}': {
    get: {
      tags: ['Workspaces'],
      summary: 'Get workspace',
      description: 'Get workspace details',
      operationId: 'getWorkspace',
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/WorkspaceId' }],
      responses: {
        '200': {
          description: 'Workspace details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Workspace' }
                }
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' },
        '404': { $ref: '#/components/responses/NotFoundError' }
      }
    }
  },

  // Social Accounts Endpoints
  '/workspaces/{workspaceId}/social-accounts': {
    get: {
      tags: ['Social Accounts'],
      summary: 'List social accounts',
      description: 'Get connected social media accounts for a workspace',
      operationId: 'listSocialAccounts',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        {
          name: 'platform',
          in: 'query',
          schema: { 
            type: 'string',
            enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']
          },
          description: 'Filter by platform'
        },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['active', 'inactive', 'error', 'pending']
          },
          description: 'Filter by status'
        }
      ],
      responses: {
        '200': {
          description: 'List of social accounts',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SocialAccount' }
                  }
                }
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    },
    post: {
      tags: ['Social Accounts'],
      summary: 'Connect social account',
      description: 'Connect a new social media account',
      operationId: 'connectSocialAccount',
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/WorkspaceId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']
                },
                authCode: {
                  type: 'string',
                  description: 'OAuth authorization code'
                },
                redirectUri: {
                  type: 'string',
                  format: 'uri',
                  description: 'OAuth redirect URI'
                }
              },
              required: ['platform', 'authCode']
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Social account connected successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/SocialAccount' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  // Posts Endpoints
  '/workspaces/{workspaceId}/posts': {
    get: {
      tags: ['Posts'],
      summary: 'List posts',
      description: 'Get posts for a workspace',
      operationId: 'listPosts',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Limit' },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['draft', 'scheduled', 'published', 'failed', 'cancelled']
          },
          description: 'Filter by post status'
        },
        {
          name: 'platforms',
          in: 'query',
          schema: { type: 'string' },
          description: 'Comma-separated list of platforms'
        },
        {
          name: 'dateFrom',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          description: 'Filter posts from date'
        },
        {
          name: 'dateTo',
          in: 'query',
          schema: { type: 'string', format: 'date' },
          description: 'Filter posts to date'
        }
      ],
      responses: {
        '200': {
          description: 'List of posts',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/PaginatedResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Post' }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    },
    post: {
      tags: ['Posts'],
      summary: 'Create post',
      description: 'Create a new post',
      operationId: 'createPost',
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/WorkspaceId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', maxLength: 200 },
                content: { type: 'string', maxLength: 2000 },
                mediaUrls: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' },
                  maxItems: 10
                },
                platforms: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1
                },
                scheduledAt: { type: 'string', format: 'date-time' },
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                },
                platformSpecific: {
                  type: 'object',
                  description: 'Platform-specific settings'
                }
              },
              required: ['content', 'platforms']
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Post created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Post' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/workspaces/{workspaceId}/posts/{postId}': {
    get: {
      tags: ['Posts'],
      summary: 'Get post',
      description: 'Get post details',
      operationId: 'getPost',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        {
          name: 'postId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }
      ],
      responses: {
        '200': {
          description: 'Post details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Post' }
                }
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '404': { $ref: '#/components/responses/NotFoundError' }
      }
    },
    patch: {
      tags: ['Posts'],
      summary: 'Update post',
      description: 'Update post content and settings',
      operationId: 'updatePost',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        {
          name: 'postId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', maxLength: 200 },
                content: { type: 'string', maxLength: 2000 },
                mediaUrls: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' }
                },
                scheduledAt: { type: 'string', format: 'date-time' },
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Post updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Post' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '404': { $ref: '#/components/responses/NotFoundError' }
      }
    },
    delete: {
      tags: ['Posts'],
      summary: 'Delete post',
      description: 'Delete a post',
      operationId: 'deletePost',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        {
          name: 'postId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }
      ],
      responses: {
        '204': {
          description: 'Post deleted successfully'
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '404': { $ref: '#/components/responses/NotFoundError' }
      }
    }
  },

  // Analytics Endpoints
  '/workspaces/{workspaceId}/analytics': {
    get: {
      tags: ['Analytics'],
      summary: 'Get workspace analytics',
      description: 'Get analytics data for a workspace',
      operationId: 'getWorkspaceAnalytics',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        {
          name: 'startDate',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'date' },
          description: 'Start date for analytics period'
        },
        {
          name: 'endDate',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'date' },
          description: 'End date for analytics period'
        },
        {
          name: 'platforms',
          in: 'query',
          schema: { type: 'string' },
          description: 'Comma-separated list of platforms'
        },
        {
          name: 'metrics',
          in: 'query',
          schema: { type: 'string' },
          description: 'Comma-separated list of metrics to include'
        }
      ],
      responses: {
        '200': {
          description: 'Analytics data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Analytics' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  // Campaigns Endpoints
  '/workspaces/{workspaceId}/campaigns': {
    get: {
      tags: ['Campaigns'],
      summary: 'List campaigns',
      description: 'Get campaigns for a workspace',
      operationId: 'listCampaigns',
      security: [{ BearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/WorkspaceId' },
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Limit' },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['draft', 'active', 'paused', 'completed', 'cancelled']
          }
        }
      ],
      responses: {
        '200': {
          description: 'List of campaigns',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/PaginatedResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Campaign' }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    },
    post: {
      tags: ['Campaigns'],
      summary: 'Create campaign',
      description: 'Create a new campaign',
      operationId: 'createCampaign',
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/WorkspaceId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 2, maxLength: 100 },
                description: { type: 'string', maxLength: 500 },
                type: {
                  type: 'string',
                  enum: ['brand_awareness', 'lead_generation', 'sales', 'engagement', 'traffic']
                },
                budget: { type: 'number', minimum: 0 },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                platforms: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1
                }
              },
              required: ['name', 'type', 'startDate', 'endDate', 'platforms']
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Campaign created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Campaign' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  // Webhooks Endpoints
  '/workspaces/{workspaceId}/webhooks': {
    get: {
      tags: ['Webhooks'],
      summary: 'List webhooks',
      description: 'Get webhooks for a workspace',
      operationId: 'listWebhooks',
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/WorkspaceId' }],
      responses: {
        '200': {
          description: 'List of webhooks',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Webhook' }
                  }
                }
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    },
    post: {
      tags: ['Webhooks'],
      summary: 'Create webhook',
      description: 'Create a new webhook',
      operationId: 'createWebhook',
      security: [{ BearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/WorkspaceId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                events: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1
                }
              },
              required: ['url', 'events']
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Webhook created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Webhook' }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/UnauthorizedError' },
        '403': { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  }
}

export default apiEndpoints