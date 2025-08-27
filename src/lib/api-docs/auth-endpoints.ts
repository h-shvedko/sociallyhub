import { OpenAPIV3 } from 'openapi-types'

export const authEndpoints: Record<string, OpenAPIV3.PathItemObject> = {
  '/auth/login': {
    post: {
      tags: ['Authentication'],
      summary: 'User login',
      description: 'Authenticate user with email and password',
      operationId: 'login',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address',
                  example: 'user@example.com'
                },
                password: {
                  type: 'string',
                  format: 'password',
                  description: 'User password',
                  minLength: 8,
                  example: 'SecurePass123!'
                },
                rememberMe: {
                  type: 'boolean',
                  description: 'Keep user logged in',
                  default: false
                }
              },
              required: ['email', 'password']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    properties: {
                      user: {
                        $ref: '#/components/schemas/User'
                      },
                      accessToken: {
                        type: 'string',
                        description: 'JWT access token',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                      },
                      refreshToken: {
                        type: 'string',
                        description: 'Refresh token for token renewal',
                        example: 'rt_1234567890abcdef'
                      },
                      expiresIn: {
                        type: 'integer',
                        description: 'Token expiration time in seconds',
                        example: 3600
                      },
                      workspace: {
                        $ref: '#/components/schemas/Workspace'
                      }
                    }
                  }
                }
              }
            }
          },
          headers: {
            'Set-Cookie': {
              description: 'HTTP-only refresh token cookie',
              schema: {
                type: 'string'
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/ValidationError'
        },
        '401': {
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'invalid_credentials',
                message: 'Invalid email or password.',
                timestamp: '2024-01-15T10:30:00Z',
                requestId: 'req_12350'
              }
            }
          }
        },
        '429': {
          $ref: '#/components/responses/RateLimitError'
        }
      }
    }
  },
  '/auth/register': {
    post: {
      tags: ['Authentication'],
      summary: 'User registration',
      description: 'Create a new user account',
      operationId: 'register',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address',
                  example: 'newuser@example.com'
                },
                password: {
                  type: 'string',
                  format: 'password',
                  description: 'User password (min 8 characters)',
                  minLength: 8,
                  example: 'SecurePass123!'
                },
                name: {
                  type: 'string',
                  description: 'Full name',
                  minLength: 2,
                  maxLength: 100,
                  example: 'John Doe'
                },
                workspaceName: {
                  type: 'string',
                  description: 'Initial workspace name',
                  minLength: 2,
                  maxLength: 50,
                  example: 'John\'s Workspace'
                },
                acceptTerms: {
                  type: 'boolean',
                  description: 'Terms of service acceptance',
                  example: true
                }
              },
              required: ['email', 'password', 'name', 'acceptTerms']
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Registration successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    properties: {
                      user: {
                        $ref: '#/components/schemas/User'
                      },
                      workspace: {
                        $ref: '#/components/schemas/Workspace'
                      },
                      message: {
                        type: 'string',
                        example: 'Account created successfully. Please check your email for verification.'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/ValidationError'
        },
        '409': {
          description: 'Email already exists',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'email_exists',
                message: 'An account with this email already exists.',
                timestamp: '2024-01-15T10:30:00Z',
                requestId: 'req_12351'
              }
            }
          }
        },
        '429': {
          $ref: '#/components/responses/RateLimitError'
        }
      }
    }
  },
  '/auth/refresh': {
    post: {
      tags: ['Authentication'],
      summary: 'Refresh access token',
      description: 'Get a new access token using refresh token',
      operationId: 'refreshToken',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: {
                  type: 'string',
                  description: 'Valid refresh token',
                  example: 'rt_1234567890abcdef'
                }
              },
              required: ['refreshToken']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Token refreshed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    properties: {
                      accessToken: {
                        type: 'string',
                        description: 'New JWT access token',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                      },
                      refreshToken: {
                        type: 'string',
                        description: 'New refresh token',
                        example: 'rt_0987654321fedcba'
                      },
                      expiresIn: {
                        type: 'integer',
                        description: 'Token expiration time in seconds',
                        example: 3600
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/ValidationError'
        },
        '401': {
          description: 'Invalid or expired refresh token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'invalid_token',
                message: 'Invalid or expired refresh token.',
                timestamp: '2024-01-15T10:30:00Z',
                requestId: 'req_12352'
              }
            }
          }
        }
      }
    }
  },
  '/auth/logout': {
    post: {
      tags: ['Authentication'],
      summary: 'User logout',
      description: 'Invalidate access and refresh tokens',
      operationId: 'logout',
      security: [
        {
          BearerAuth: []
        }
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: {
                  type: 'string',
                  description: 'Refresh token to invalidate',
                  example: 'rt_1234567890abcdef'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Logout successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  message: {
                    type: 'string',
                    example: 'Logged out successfully'
                  }
                }
              }
            }
          }
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError'
        }
      }
    }
  },
  '/auth/forgot-password': {
    post: {
      tags: ['Authentication'],
      summary: 'Request password reset',
      description: 'Send password reset email to user',
      operationId: 'forgotPassword',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address',
                  example: 'user@example.com'
                }
              },
              required: ['email']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Password reset email sent',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  message: {
                    type: 'string',
                    example: 'If an account with this email exists, a password reset link has been sent.'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/ValidationError'
        },
        '429': {
          $ref: '#/components/responses/RateLimitError'
        }
      }
    }
  },
  '/auth/reset-password': {
    post: {
      tags: ['Authentication'],
      summary: 'Reset password',
      description: 'Reset user password using reset token',
      operationId: 'resetPassword',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'Password reset token from email',
                  example: 'reset_token_12345'
                },
                password: {
                  type: 'string',
                  format: 'password',
                  description: 'New password (min 8 characters)',
                  minLength: 8,
                  example: 'NewSecurePass123!'
                },
                confirmPassword: {
                  type: 'string',
                  format: 'password',
                  description: 'Confirm new password',
                  minLength: 8,
                  example: 'NewSecurePass123!'
                }
              },
              required: ['token', 'password', 'confirmPassword']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Password reset successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  message: {
                    type: 'string',
                    example: 'Password reset successful. You can now login with your new password.'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/ValidationError'
        },
        '401': {
          description: 'Invalid or expired reset token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'invalid_token',
                message: 'Invalid or expired password reset token.',
                timestamp: '2024-01-15T10:30:00Z',
                requestId: 'req_12353'
              }
            }
          }
        }
      }
    }
  },
  '/auth/verify-email': {
    post: {
      tags: ['Authentication'],
      summary: 'Verify email address',
      description: 'Verify user email using verification token',
      operationId: 'verifyEmail',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'Email verification token',
                  example: 'verify_token_12345'
                }
              },
              required: ['token']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Email verified successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  message: {
                    type: 'string',
                    example: 'Email verified successfully.'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/ValidationError'
        },
        '401': {
          description: 'Invalid or expired verification token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'invalid_token',
                message: 'Invalid or expired verification token.',
                timestamp: '2024-01-15T10:30:00Z',
                requestId: 'req_12354'
              }
            }
          }
        }
      }
    }
  },
  '/auth/me': {
    get: {
      tags: ['Authentication'],
      summary: 'Get current user',
      description: 'Get authenticated user information',
      operationId: 'getCurrentUser',
      security: [
        {
          BearerAuth: []
        }
      ],
      responses: {
        '200': {
          description: 'Current user information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    properties: {
                      user: {
                        $ref: '#/components/schemas/User'
                      },
                      workspace: {
                        $ref: '#/components/schemas/Workspace'
                      },
                      permissions: {
                        type: 'array',
                        items: {
                          type: 'string'
                        },
                        description: 'User permissions in current workspace'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError'
        }
      }
    }
  }
}

export default authEndpoints