import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeUserId } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
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

    // For now, we'll simulate invoice creation since we don't have an Invoice model
    // In a real implementation, you would save to your database
    const invoiceData = {
      id: `invoice_${Date.now()}`,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      clientId,
      clientName,
      clientEmail,
      dueDate,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      currency: currency || 'USD',
      lineItems,
      subtotal: subtotal || 0,
      tax: tax || 0,
      discount: discount || 0,
      total: total || subtotal || 0,
      notes,
      terms,
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: userId
    }

    // Here you would typically save the invoice to your database
    // await prisma.invoice.create({ data: invoiceData })
    
    console.log('📄 Invoice created:', invoiceData)

    return NextResponse.json({
      success: true,
      invoice: invoiceData,
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

    const userId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // For now, we'll return mock invoices since we don't have an Invoice model
    // In a real implementation, you would query your database
    const mockInvoices = [
      {
        id: 'inv_1',
        invoiceNumber: 'INV-001',
        clientName: 'Acme Corporation',
        clientEmail: 'billing@acme.com',
        amount: 5000,
        currency: 'USD',
        status: 'paid',
        dueDate: '2025-09-15',
        issueDate: '2025-08-15',
        createdAt: '2025-08-15T10:00:00.000Z'
      },
      {
        id: 'inv_2',
        invoiceNumber: 'INV-002',
        clientName: 'TechStart Inc.',
        clientEmail: 'finance@techstart.com',
        amount: 3500,
        currency: 'USD',
        status: 'pending',
        dueDate: '2025-09-20',
        issueDate: '2025-08-20',
        createdAt: '2025-08-20T14:30:00.000Z'
      }
    ]

    return NextResponse.json({
      invoices: mockInvoices.slice(offset, offset + limit),
      pagination: {
        limit,
        offset,
        total: mockInvoices.length,
        hasMore: (offset + limit) < mockInvoices.length
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