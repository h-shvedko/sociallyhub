import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
// GET /api/invoices/[id] - Get invoice details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        workspace: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if user has access to this invoice's workspace (ADR-0004;
    // non-members get 404 per ADR-0005 no-existence-leak semantics)
    await requireWorkspaceRole(invoice.workspaceId)

    return NextResponse.json({ invoice })
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error)
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

// PATCH /api/invoices/[id] - Update invoice
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    // First get the invoice to check permissions
    const invoice = await prisma.invoice.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if user has access to this invoice's workspace (ADR-0004;
    // non-members get 404 per ADR-0005 no-existence-leak semantics)
    await requireWorkspaceRole(invoice.workspaceId)

    // Calculate subtotal and total from line items
    const lineItems = body.lineItems || invoice.lineItems
    const tax = body.tax !== undefined ? body.tax : invoice.tax
    const discount = body.discount !== undefined ? body.discount : invoice.discount
    
    // Calculate totals
    const subtotal = Array.isArray(lineItems) 
      ? lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
      : (body.amount || invoice.total || 0)
    const taxAmount = subtotal * (tax / 100)
    const total = subtotal + taxAmount - discount

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: body.status || invoice.status,
        subtotal: subtotal,
        total: total,
        currency: body.currency || invoice.currency,
        dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
        notes: body.notes !== undefined ? body.notes : invoice.notes,
        lineItems: lineItems,
        tax: tax,
        discount: discount,
        updatedAt: new Date()
      },
      include: {
        client: true
      }
    })

    console.log(`📄 Invoice ${id} updated, status: ${updatedInvoice.status}`)

    return NextResponse.json({ 
      success: true,
      invoice: updatedInvoice 
    })
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error)
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE /api/invoices/[id] - Delete invoice
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // First get the invoice to check permissions
    const invoice = await prisma.invoice.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if user has access to this invoice's workspace (ADR-0004;
    // non-members get 404 per ADR-0005 no-existence-leak semantics)
    await requireWorkspaceRole(invoice.workspaceId)

    // Delete the invoice
    await prisma.invoice.delete({
      where: { id }
    })

    console.log(`📄 Invoice ${id} deleted successfully from database`)

    return NextResponse.json({ 
      success: true,
      message: 'Invoice deleted successfully' 
    })
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error)
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}