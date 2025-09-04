import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    
    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const body = await request.json()

    const {
      invoiceNumber,
      clientId,
      clientName,
      clientEmail,
      dueDate,
      issueDate,
      currency,
      lineItems,
      subtotal,
      tax,
      discount,
      total,
      notes,
      terms
    } = body

    // Validate required fields
    if (!clientId || !clientName || !dueDate || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, clientName, dueDate, and lineItems are required' },
        { status: 400 }
      )
    }

    // Generate unique invoice number if not provided
    const finalInvoiceNumber = invoiceNumber || `INV-${Date.now()}`

    // Create invoice in database
    const createdInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: finalInvoiceNumber,
        workspaceId: userWorkspace.workspaceId,
        clientId,
        clientName,
        clientEmail: clientEmail || null,
        dueDate: new Date(dueDate),
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        currency: currency || 'USD',
        lineItems: lineItems,
        subtotal: parseFloat(subtotal) || 0,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        total: parseFloat(total) || parseFloat(subtotal) || 0,
        notes: notes || null,
        terms: terms || null,
        status: 'draft'
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
            company: true
          }
        }
      }
    })
    
    console.log('📄 Invoice created successfully:', createdInvoice.id)

    return NextResponse.json({
      success: true,
      invoice: {
        id: createdInvoice.id,
        invoiceNumber: createdInvoice.invoiceNumber,
        clientName: createdInvoice.clientName,
        clientEmail: createdInvoice.clientEmail,
        amount: createdInvoice.total,
        currency: createdInvoice.currency,
        status: createdInvoice.status,
        dueDate: createdInvoice.dueDate.toISOString().split('T')[0],
        issueDate: createdInvoice.issueDate.toISOString().split('T')[0],
        createdAt: createdInvoice.createdAt.toISOString()
      },
      message: 'Invoice created successfully'
    })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch invoices from database
    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          workspaceId: userWorkspace.workspaceId
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit,
        include: {
          client: {
            select: {
              name: true,
              email: true,
              company: true
            }
          }
        }
      }),
      prisma.invoice.count({
        where: {
          workspaceId: userWorkspace.workspaceId
        }
      })
    ])

    // Format invoices for frontend
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      amount: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      createdAt: invoice.createdAt.toISOString()
    }))

    return NextResponse.json({
      invoices: formattedInvoices,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: (offset + limit) < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}