import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      clientName,
      clientEmail,
      clientCompany,
      invoiceNumber,
      issueDate,
      dueDate,
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
    if (!clientName || !invoiceNumber || !total || !lineItems?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: clientName, invoiceNumber, total, and lineItems are required' },
        { status: 400 }
      )
    }

    console.log('📄 Generating PDF invoice for:', clientName)

    // Generate professional HTML for PDF conversion
    const htmlContent = generateInvoiceHTML({
      clientName,
      clientEmail,
      clientCompany,
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      lineItems,
      subtotal,
      tax,
      discount,
      total,
      notes,
      terms
    })

    // For now, we'll create a simple PDF-like response
    // In a production environment, you would use a library like puppeteer or jsPDF
    const pdfBuffer = generateSimplePDF(htmlContent, invoiceNumber)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating PDF invoice:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF invoice' },
      { status: 500 }
    )
  }
}

function generateInvoiceHTML({
  clientName,
  clientEmail,
  clientCompany,
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  lineItems,
  subtotal,
  tax,
  discount,
  total,
  notes,
  terms
}: any) {
  const formatCurrency = (amount: number, curr = currency || 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const lineItemsHtml = lineItems.map((item: any, index: number) => `
    <tr style="${index % 2 === 0 ? 'background-color: #f8fafc;' : ''}">
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
      <td style="padding: 12px 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.rate)}</td>
      <td style="padding: 12px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; color: #1f2937; line-height: 1.5; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
        .company-info { flex: 1; }
        .company-name { font-size: 28px; font-weight: bold; color: #1e40af; margin-bottom: 10px; }
        .company-tagline { color: #6b7280; font-size: 14px; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 10px; }
        .invoice-number { font-size: 18px; color: #6b7280; }
        .details-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .bill-to, .invoice-details { flex: 1; }
        .bill-to { margin-right: 40px; }
        .section-title { font-size: 16px; font-weight: bold; color: #374151; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
        .client-info { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #1e40af; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        .invoice-table th { background: #1e40af; color: white; padding: 15px 8px; text-align: left; font-weight: 600; }
        .invoice-table th:last-child { text-align: right; }
        .invoice-table th:nth-child(2), .invoice-table th:nth-child(3) { text-align: center; }
        .invoice-table th:nth-child(3), .invoice-table th:nth-child(4) { text-align: right; }
        .totals-section { margin-top: 20px; }
        .totals-table { width: 100%; max-width: 300px; margin-left: auto; }
        .totals-table td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .totals-table .total-row { background: #1e40af; color: white; font-weight: bold; font-size: 18px; }
        .totals-table .total-row td { padding: 15px 8px; border: none; }
        .terms-section { margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb; }
        .terms-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #374151; }
        .terms-content { color: #6b7280; font-size: 14px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .container { padding: 20px 0; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">📱 SociallyHub</div>
            <div class="company-tagline">Social Media Management Solutions</div>
            <div style="margin-top: 15px; font-size: 14px; color: #6b7280;">
              Email: billing@sociallyhub.com<br>
              Phone: (555) 123-4567<br>
              Web: www.sociallyhub.com
            </div>
          </div>
          <div class="invoice-info">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">#${invoiceNumber}</div>
          </div>
        </div>

        <!-- Bill To & Invoice Details -->
        <div class="details-section">
          <div class="bill-to">
            <div class="section-title">Bill To</div>
            <div class="client-info">
              <div style="font-weight: 600; font-size: 16px; margin-bottom: 5px;">${clientCompany || clientName}</div>
              ${clientCompany && clientCompany !== clientName ? `<div style="margin-bottom: 5px;">Attn: ${clientName}</div>` : ''}
              <div style="color: #6b7280;">${clientEmail}</div>
            </div>
          </div>
          <div class="invoice-details">
            <div class="section-title">Invoice Details</div>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Invoice Date:</td>
                <td style="padding: 5px 0; text-align: right; font-weight: 600;">${formatDate(issueDate)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Due Date:</td>
                <td style="padding: 5px 0; text-align: right; font-weight: 600;">${formatDate(dueDate)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Currency:</td>
                <td style="padding: 5px 0; text-align: right; font-weight: 600;">${currency}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Invoice Items -->
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right; font-weight: 600;">${formatCurrency(subtotal)}</td>
            </tr>
            ${tax > 0 ? `
            <tr>
              <td>Tax:</td>
              <td style="text-align: right;">${formatCurrency(tax)}</td>
            </tr>` : ''}
            ${discount > 0 ? `
            <tr>
              <td>Discount:</td>
              <td style="text-align: right; color: #dc2626;">-${formatCurrency(discount)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td>TOTAL DUE:</td>
              <td style="text-align: right;">${formatCurrency(total)}</td>
            </tr>
          </table>
        </div>

        ${notes ? `
        <div class="terms-section">
          <div class="terms-title">Notes</div>
          <div class="terms-content">${notes}</div>
        </div>
        ` : ''}

        ${terms ? `
        <div class="terms-section">
          <div class="terms-title">Payment Terms</div>
          <div class="terms-content">${terms}</div>
        </div>
        ` : ''}

        <div class="terms-section">
          <div class="terms-title">Payment Information</div>
          <div class="terms-content">
            Please remit payment by the due date shown above. We accept the following payment methods:
            <br><br>
            • <strong>Online Payment:</strong> Visit our payment portal at www.sociallyhub.com/pay
            <br>
            • <strong>Bank Transfer:</strong> ACH transfers (3-5 business days)
            <br>
            • <strong>Credit Card:</strong> Visa, MasterCard, American Express
            <br>
            • <strong>PayPal:</strong> payments@sociallyhub.com
            <br><br>
            Questions? Contact us at billing@sociallyhub.com or (555) 123-4567
          </div>
        </div>

        <div class="footer">
          <div>Thank you for your business!</div>
          <div style="margin-top: 10px;">© ${new Date().getFullYear()} SociallyHub. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `
}

// Simple PDF-like text generation (in a real app, use puppeteer or similar)
function generateSimplePDF(htmlContent: string, invoiceNumber: string): Buffer {
  // This is a simplified implementation that creates a text-based "PDF"
  // In a real application, you would use libraries like:
  // - puppeteer to generate real PDFs from HTML
  // - jsPDF for client-side PDF generation
  // - PDFKit for server-side PDF generation with more control
  
  const textContent = `
SOCIALLYHUB - INVOICE ${invoiceNumber}
======================================

${htmlContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()}

Generated on: ${new Date().toISOString()}
  `

  // Convert text to buffer (in reality, this would be a real PDF buffer)
  return Buffer.from(textContent, 'utf8')
}