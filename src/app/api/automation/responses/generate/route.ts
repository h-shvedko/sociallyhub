import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SmartResponseSystem, MessageContext } from '@/lib/automation/smart-response-system'
import { z } from 'zod'
import { Platform, ResponseTone, ResponseType } from '@prisma/client'

const GenerateResponseRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  messageContext: z.object({
    id: z.string(),
    content: z.string(),
    platform: z.nativeEnum(Platform),
    authorName: z.string().optional(),
    authorId: z.string().optional(),
    isPublic: z.boolean(),
    parentMessageId: z.string().optional(),
    timestamp: z.string().transform(str => new Date(str)),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    language: z.string().optional(),
    metadata: z.any().optional()
  }),
  options: z.object({
    tone: z.nativeEnum(ResponseTone).optional(),
    responseType: z.nativeEnum(ResponseType).optional(),
    includePersonalization: z.boolean().optional(),
    maxLength: z.number().optional(),
    platform: z.nativeEnum(Platform).optional(),
    brandVoice: z.string().optional(),
    escalationThreshold: z.number().optional(),
    autoApprove: z.boolean().optional(),
    templateCategories: z.array(z.string()).optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = GenerateResponseRequestSchema.parse(body)

    const smartResponseSystem = new SmartResponseSystem()
    const responses = await smartResponseSystem.generateResponse(
      validatedData.workspaceId,
      validatedData.messageContext as MessageContext,
      validatedData.options || {}
    )

    return NextResponse.json({
      success: true,
      responses,
      count: responses.length,
      messageId: validatedData.messageContext.id,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating responses:', error)
    
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
      { error: 'Failed to generate responses' },
      { status: 500 }
    )
  }
}