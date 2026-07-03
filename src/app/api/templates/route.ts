import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const type = searchParams.get('type') // 'POST', 'EMAIL', etc.
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace (ADR-0004)
    const userId = await normalizeUserId(session.user.id)
    await requireWorkspaceRole(workspaceId)

    // Build where clause
    const where: any = { workspaceId }
    if (type && type !== 'all') {
      where.type = type
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Get current user info for created_by display
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    })

    // Transform templates to match frontend interface
    const transformedTemplates = templates.map(template => {
      // Map database type back to frontend-friendly type
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

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        content: template.content,
        type: getFrontendType(template.type),
        category: 'General', // Default category since it's not in the model
        tags: template.tags || [],
        platforms: (template.platforms || []).map(p => p.toLowerCase()),
        variables: template.variables,
        usage_count: 0, // Would need separate tracking table
        created_at: template.createdAt.toISOString(),
        updated_at: template.updatedAt.toISOString(),
        created_by: {
          name: currentUser?.name || 'Unknown User',
          email: currentUser?.email || 'unknown@sociallyhub.com'
        }
      }
    })

    const total = await prisma.template.count({ where })

    return NextResponse.json({
      templates: transformedTemplates,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, name, description, content, type, variables, platforms, tags } = body

    if (!workspaceId || !name || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to workspace (ADR-0004)
    const userId = await normalizeUserId(session.user.id)
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

    // Extract variables from content (find {{variable}} patterns)
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

    const template = await prisma.template.create({
      data: {
        workspaceId,
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
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateIds, workspaceId } = body

    if (!templateIds || !Array.isArray(templateIds) || !workspaceId) {
      return NextResponse.json({ error: 'Template IDs and workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace (ADR-0004)
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

    // Delete templates from database
    await prisma.template.deleteMany({
      where: {
        id: { in: templateIds },
        workspaceId: workspaceId
      }
    })

    return NextResponse.json({ 
      success: true,
      deletedCount: templateIds.length 
    })

  } catch (error) {
    return handleApiError(error)
  }
}