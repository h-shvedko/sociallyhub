import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SmartResponseSystem } from '@/lib/automation/smart-response-system'
import { z } from 'zod'
import { ResponseTone, Platform } from '@prisma/client'

const CreateTemplateRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  category: z.string().min(1),
  keywords: z.array(z.string()),
  template: z.string().min(1),
  tone: z.nativeEnum(ResponseTone),
  platform: z.nativeEnum(Platform).optional(),
  language: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CreateTemplateRequestSchema.parse(body)

    const smartResponseSystem = new SmartResponseSystem()
    const template = await smartResponseSystem.createResponseTemplate(
      validatedData.workspaceId,
      {
        category: validatedData.category,
        keywords: validatedData.keywords,
        template: validatedData.template,
        tone: validatedData.tone,
        platform: validatedData.platform,
        language: validatedData.language
      },
      session.user.id
    )

    return NextResponse.json({
      success: true,
      template,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error creating response template:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create response template' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const smartResponseSystem = new SmartResponseSystem()
    const templates = await smartResponseSystem.getResponseTemplates(
      workspaceId,
      category || undefined
    )

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length
    })
  } catch (error) {
    console.error('Error fetching response templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch response templates' },
      { status: 500 }
    )
  }
}