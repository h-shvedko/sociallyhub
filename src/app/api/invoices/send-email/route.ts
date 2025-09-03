import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeUserId } from '@/lib/auth/demo-user'
import nodemailer from 'nodemailer'

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
      invoiceNumber,
      total,
      dueDate,
      lineItems
    } = body

    // Validate required fields
    if (!clientEmail || !invoiceNumber || !total) {
      return NextResponse.json(
        { error: 'Missing required fields: clientEmail, invoiceNumber, and total are required' },
        { status: 400 }
      )
    }

    // Create email transporter using the same SMTP settings as other emails
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    })

    // Generate professional invoice email content
    const emailContent = generateInvoiceEmailContent({
      clientName,
      invoiceNumber,
      total,
      dueDate,
      lineItems
    })

    const emailOptions = {
      from: process.env.SMTP_FROM || 'noreply@sociallyhub.com',
      to: clientEmail,
      subject: `Invoice ${invoiceNumber} from SociallyHub`,
      html: emailContent,
      text: stripHtmlTags(emailContent)
    }

    console.log('📧 Sending invoice email to:', clientEmail)
    await transporter.sendMail(emailOptions)
    
    console.log('✅ Invoice email sent successfully')

    return NextResponse.json({
      success: true,
      message: `Invoice email sent successfully to ${clientEmail}`,
      invoiceNumber,
      recipientEmail: clientEmail
    })
  } catch (error) {
    console.error('Error sending invoice email:', error)
    return NextResponse.json(
      { error: 'Failed to send invoice email' },
      { status: 500 }
    )
  }
}

function generateInvoiceEmailContent({ clientName, invoiceNumber, total, dueDate, lineItems }: any) {
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(total)

  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const lineItemsHtml = lineItems.map((item: any) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 0; text-align: left;">${item.description}</td>
      <td style="padding: 12px 0; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 0; text-align: right;">$${item.rate.toFixed(2)}</td>
      <td style="padding: 12px 0; text-align: right; font-weight: 600;">$${item.amount.toFixed(2)}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 30px 20px; text-align: center; }
        .invoice-details { background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .invoice-table th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; }
        .total-row { background: #1e40af; color: white; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; background: #f8fafc; }
        .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 Invoice ${invoiceNumber}</h1>
          <p>SociallyHub - Social Media Management</p>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear ${clientName || 'Valued Client'},</p>
          
          <p>Thank you for choosing SociallyHub for your social media management needs. Please find your invoice details below:</p>
          
          <div class="invoice-details">
            <h3>Invoice Details</h3>
            <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p><strong>Invoice Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${formattedDueDate}</p>
            <p><strong>Total Amount:</strong> ${formattedTotal}</p>
          </div>
          
          <table class="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
              <tr class="total-row">
                <td colspan="3" style="padding: 15px 0; text-align: right;"><strong>Total Amount Due:</strong></td>
                <td style="padding: 15px 0; text-align: right;"><strong>${formattedTotal}</strong></td>
              </tr>
            </tbody>
          </table>
          
          <div style="margin: 30px 0; padding: 20px; background: #dbeafe; border-radius: 8px;">
            <h4>Payment Information</h4>
            <p>Please remit payment by ${formattedDueDate}. You can pay via:</p>
            <ul>
              <li>Bank Transfer (ACH)</li>
              <li>Credit Card</li>
              <li>PayPal</li>
            </ul>
            <p><strong>Payment Portal:</strong> <a href="#" class="button">Pay Invoice Online</a></p>
          </div>
          
          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>
          <strong>SociallyHub Team</strong><br>
          Email: billing@sociallyhub.com<br>
          Phone: (555) 123-4567</p>
        </div>
        
        <div class="footer">
          <p><small>This is an automated email from SociallyHub. Please do not reply to this email.</small></p>
          <p><small>&copy; ${new Date().getFullYear()} SociallyHub. All rights reserved.</small></p>
        </div>
      </div>
    </body>
    </html>
  `
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}