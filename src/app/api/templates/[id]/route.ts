import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templateId = params.id
    const userId = await normalizeUserId(session.user.id)

    // Find template and verify user has access to its workspace
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        workspace: {
          users: {
            some: { userId }
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Get current user info for created_by display
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    })

    // Map database type back to frontend type
    const getFrontendType = (dbType: string) => {
      switch (dbType) {
        case 'POST':
          return 'SOCIAL_POST'
        case 'RESPONSE':
          return 'EMAIL'
        default:
          return 'SOCIAL_POST'
      }
    }

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      type: getFrontendType(template.type),
      category: 'General',
      tags: template.tags || [],
      platforms: (template.platforms || []).map(p => p.toLowerCase()),
      variables: template.variables,
      usage_count: 0,
      created_at: template.createdAt.toISOString(),
      updated_at: template.updatedAt.toISOString(),
      created_by: {
        name: currentUser?.name || 'Unknown User',
        email: currentUser?.email || 'unknown@sociallyhub.com'
      }
    })

  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templateId = params.id
    const body = await request.json()
    const { name, description, content, type, variables, platforms, tags } = body

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 })
    }

    const userId = await normalizeUserId(session.user.id)

    // Verify user has access to the template's workspace
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        workspace: {
          users: {
            some: { 
              userId,
              role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
            }
          }
        }
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found or insufficient permissions' }, { status: 404 })
    }

    // Extract variables from content if not provided
    const extractedVariables = Array.from(
      content.matchAll(/\{\{([^}]+)\}\}/g),
      match => match[1].trim()
    )

    // Map frontend type to database TemplateType enum
    const getValidTemplateType = (inputType: string) => {
      switch (inputType?.toUpperCase()) {
        case 'EMAIL':
        case 'SOCIAL_POST':
        case 'POST':
          return 'POST'
        case 'RESPONSE':
        case 'AUTO_RESPONSE':
          return 'RESPONSE'
        default:
          return 'POST'
      }
    }

    // Map platform strings to SocialProvider enum
    const validPlatforms = platforms?.filter((p: string) => 
      ['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK'].includes(p.toUpperCase())
    ).map((p: string) => p.toUpperCase()) || []

    const updatedTemplate = await prisma.template.update({
      where: { id: templateId },
      data: {
        name,
        description,
        content,
        type: getValidTemplateType(type),
        variables: variables || extractedVariables,
        platforms: validPlatforms,
        tags: tags || []
      }
    })

    // Get current user info for response
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    })

    // Map database type back to frontend type for response
    const getFrontendType = (dbType: string) => {
      switch (dbType) {
        case 'POST':
          return 'SOCIAL_POST'
        case 'RESPONSE':
          return 'EMAIL'
        default:
          return 'SOCIAL_POST'
      }
    }

    return NextResponse.json({
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      content: updatedTemplate.content,
      type: getFrontendType(updatedTemplate.type),
      category: 'General',
      tags: updatedTemplate.tags || [],
      platforms: (updatedTemplate.platforms || []).map(p => p.toLowerCase()),
      variables: updatedTemplate.variables,
      usage_count: 0,
      created_at: updatedTemplate.createdAt.toISOString(),
      updated_at: updatedTemplate.updatedAt.toISOString(),
      created_by: {
        name: currentUser?.name || 'Unknown User',
        email: currentUser?.email || 'unknown@sociallyhub.com'
      }
    })

  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templateId = params.id
    const userId = await normalizeUserId(session.user.id)

    // Verify user has access to the template's workspace
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        workspace: {
          users: {
            some: { 
              userId,
              role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
            }
          }
        }
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found or insufficient permissions' }, { status: 404 })
    }

    await prisma.template.delete({
      where: { id: templateId }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Template deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}