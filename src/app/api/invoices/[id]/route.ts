import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

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

    const userId = await normalizeUserId(session.user.id)

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

    // Check if user has access to this invoice's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        workspaceId: invoice.workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
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

    const userId = await normalizeUserId(session.user.id)

    const { id } = await context.params
    const body = await request.json()

    // First get the invoice to check permissions
    const invoice = await prisma.invoice.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if user has access to this invoice's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        workspaceId: invoice.workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: body.status || invoice.status,
        amount: body.amount !== undefined ? body.amount : invoice.amount,
        currency: body.currency || invoice.currency,
        dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
        notes: body.notes !== undefined ? body.notes : invoice.notes,
        lineItems: body.lineItems || invoice.lineItems,
        tax: body.tax !== undefined ? body.tax : invoice.tax,
        discount: body.discount !== undefined ? body.discount : invoice.discount,
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

    const userId = await normalizeUserId(session.user.id)

    const { id } = await context.params

    // First get the invoice to check permissions
    const invoice = await prisma.invoice.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if user has admin/owner access to this invoice's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        workspaceId: invoice.workspaceId,
        role: {
          in: ['OWNER', 'ADMIN']
        }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete the invoice
    await prisma.invoice.delete({
      where: { id }
    })

    console.log(`📄 Invoice ${id} deleted successfully`)

    return NextResponse.json({ 
      success: true,
      message: 'Invoice deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}