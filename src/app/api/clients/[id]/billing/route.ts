import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

async function getBillingHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await params
    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get client billing information
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: userWorkspace.workspaceId
      },
      select: {
        id: true,
        name: true,
        billingInfo: true
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({
      clientId: client.id,
      clientName: client.name,
      billing: client.billingInfo || null
    })
  } catch (error) {
    console.error('Error fetching billing information:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function setBillingHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await params
    const body = await req.json()
    const { 
      contractValue, 
      currency, 
      billingCycle, 
      startDate, 
      endDate, 
      paymentTerms, 
      services, 
      notes 
    } = body

    if (!contractValue || !currency || !billingCycle) {
      return NextResponse.json({ 
        error: 'Missing required fields: contractValue, currency, billingCycle' 
      }, { status: 400 })
    }

    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Verify client exists and belongs to workspace
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Update client with billing information
    const billingData = {
      contractValue: parseFloat(contractValue),
      currency,
      billingCycle,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      paymentTerms: parseInt(paymentTerms) || 30,
      services: services || '',
      notes: notes || '',
      createdAt: new Date(),
      updatedBy: userId
    }

    const updatedClient = await prisma.client.update({
      where: {
        id: clientId
      },
      data: {
        billingInfo: billingData
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        }
      }
    })

    console.log('✅ Billing information saved for client:', updatedClient.name, billingData)

    return NextResponse.json({
      success: true,
      message: 'Billing information saved successfully',
      clientId: updatedClient.id,
      clientName: updatedClient.name,
      billing: billingData
    })
  } catch (error) {
    console.error('Error saving billing information:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getBillingHandler, 'client-billing-get')
export const POST = withLogging(setBillingHandler, 'client-billing-set')