import nodemailer from 'nodemailer'
import { EmailNotificationData } from './types'
import { ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

export interface EmailServiceConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
  replyTo?: string
  maxRetries: number
  retryDelay: number
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailServiceConfig

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || ''
      },
      from: process.env.SMTP_FROM || 'noreply@sociallyhub.com',
      replyTo: process.env.SMTP_REPLY_TO,
      maxRetries: 3,
      retryDelay: 2000
    }

    this.initializeTransporter()
  }

  private initializeTransporter(): void {
    try {
      // Check if this is Mailhog (localhost:1025) or other local SMTP without auth
      const isMailhog = this.config.host === 'localhost' && this.config.port === 1025
      const isLocalSMTP = this.config.host === 'localhost' || this.config.host === 'mailhog'
      
      // For production SMTP servers, require authentication
      if (!isLocalSMTP && (!this.config.auth.user || !this.config.auth.pass)) {
        console.warn('Email service not configured - SMTP credentials missing for production server')
        return
      }

      // Create transporter config
      const transporterConfig: any = {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 10
      }

      // Only add auth if credentials are provided (not needed for Mailhog)
      if (this.config.auth.user && this.config.auth.pass) {
        transporterConfig.auth = this.config.auth
      }

      this.transporter = nodemailer.createTransport(transporterConfig)

      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          ErrorLogger.logExternalServiceError(
            'smtp',
            error,
            { operation: 'connection_verify' }
          )
        } else {
          console.log('Email service initialized:', {
            host: this.config.host,
            port: this.config.port
          })
        }
      })

    } catch (error) {
      ErrorLogger.logExternalServiceError(
        'smtp',
        error as Error,
        { operation: 'initialize_transporter' }
      )
    }
  }

  async send(emailData: EmailNotificationData): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not initialized - check SMTP configuration')
    }

    const timer = PerformanceLogger.startTimer('send_email')

    let retryCount = 0
    while (retryCount <= this.config.maxRetries) {
      try {
        const mailOptions = {
          from: this.config.from,
          replyTo: this.config.replyTo,
          to: emailData.to.join(', '),
          cc: emailData.cc?.join(', '),
          bcc: emailData.bcc?.join(', '),
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          attachments: emailData.attachments,
          headers: emailData.headers
        }

        const result = await this.transporter.sendMail(mailOptions)

        console.log('Email sent successfully:', {
          messageId: result.messageId,
          recipients: emailData.to.length,
          retryCount,
          subject: emailData.subject
        })

        timer.end({
          success: true,
          recipients: emailData.to.length,
          retryCount
        })

        return

      } catch (error) {
        retryCount++
        
        if (retryCount > this.config.maxRetries) {
          timer.end({
            success: false,
            error: true,
            retryCount: retryCount - 1
          })

          ErrorLogger.logExternalServiceError(
            'smtp',
            error as Error,
            {
              operation: 'send_email',
              recipients: emailData.to.length,
              subject: emailData.subject,
              retryCount: retryCount - 1
            }
          )

          throw error
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * retryCount)
      }
    }
  }

  async sendBulk(emails: EmailNotificationData[]): Promise<void> {
    const timer = PerformanceLogger.startTimer('send_bulk_emails')

    try {
      const promises = emails.map(email => this.send(email))
      const results = await Promise.allSettled(promises)

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      console.log('Bulk emails sent:', {
        total: emails.length,
        successful,
        failed
      })

      timer.end({
        total: emails.length,
        successful,
        failed
      })

      // Log failed emails
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          ErrorLogger.logExternalServiceError(
            'smtp',
            result.reason,
            {
              operation: 'bulk_email_failed',
              emailIndex: index,
              subject: emails[index]?.subject
            }
          )
        }
      })

    } catch (error) {
      timer.end({ error: true })
      throw error
    }
  }

  async sendTemplate(
    templateName: string,
    recipients: string[],
    variables: Record<string, any>
  ): Promise<void> {
    const template = await this.getTemplate(templateName)
    if (!template) {
      throw new Error(`Email template not found: ${templateName}`)
    }

    const emailData: EmailNotificationData = {
      to: recipients,
      subject: this.processTemplate(template.subject, variables),
      html: this.processTemplate(template.html, variables),
      text: this.processTemplate(template.text, variables)
    }

    await this.send(emailData)
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processed = processed.replace(regex, String(value || ''))
    })

    return processed
  }

  private async getTemplate(templateName: string): Promise<{
    subject: string
    html: string
    text: string
  } | null> {
    // TODO: Implement template storage/retrieval
    // For now, return null to indicate template not found
    return null
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      ErrorLogger.logExternalServiceError(
        'smtp',
        error as Error,
        { operation: 'test_connection' }
      )
      return false
    }
  }

  getConfig(): Omit<EmailServiceConfig, 'auth'> {
    return {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      from: this.config.from,
      replyTo: this.config.replyTo,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    }
  }

  // Utility methods for different email types
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    const emailData: EmailNotificationData = {
      to: [userEmail],
      subject: 'Welcome to SociallyHub! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to SociallyHub!</h1>
          <p>Hi ${userName},</p>
          <p>Welcome to SociallyHub! We're excited to help you manage your social media presence more effectively.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Getting Started</h2>
            <ul>
              <li>Connect your social media accounts</li>
              <li>Create your first post</li>
              <li>Invite team members</li>
              <li>Explore analytics dashboard</li>
            </ul>
          </div>
          
          <p>If you have any questions, don't hesitate to reach out to our support team.</p>
          <p>Happy posting!</p>
          <p>The SociallyHub Team</p>
        </div>
      `,
      text: `Welcome to SociallyHub! Hi ${userName}, we're excited to help you manage your social media presence more effectively.`
    }

    await this.send(emailData)
  }

  async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`
    
    const emailData: EmailNotificationData = {
      to: [userEmail],
      subject: 'Reset Your SociallyHub Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Password Reset Request</h1>
          <p>We received a request to reset your SociallyHub password.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          
          <p>Best regards,<br>The SociallyHub Team</p>
        </div>
      `,
      text: `Password Reset Request: Click this link to reset your password: ${resetUrl} (expires in 1 hour)`
    }

    await this.send(emailData)
  }

  async sendTeamInvitationEmail(
    inviteeEmail: string, 
    inviterName: string, 
    workspaceName: string, 
    invitationUrl: string
  ): Promise<void> {
    const emailData: EmailNotificationData = {
      to: [inviteeEmail],
      subject: `You're invited to join ${workspaceName} on SociallyHub`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">You're Invited!</h1>
          <p>${inviterName} has invited you to join the <strong>${workspaceName}</strong> workspace on SociallyHub.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">About SociallyHub</h2>
            <p>SociallyHub is a comprehensive social media management platform that helps teams:</p>
            <ul>
              <li>Schedule and publish content across multiple platforms</li>
              <li>Collaborate on content creation and approval</li>
              <li>Track performance with detailed analytics</li>
              <li>Manage team workflows efficiently</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          
          <p>This invitation will expire in 7 days.</p>
          <p>Welcome to the team!</p>
        </div>
      `,
      text: `${inviterName} invited you to join ${workspaceName} on SociallyHub. Accept invitation: ${invitationUrl}`
    }

    await this.send(emailData)
  }

  async sendEmailVerification(userEmail: string, userName: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${verificationToken}`
    
    const emailData: EmailNotificationData = {
      to: [userEmail],
      subject: 'Verify Your Email Address - SociallyHub',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: #2563eb; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
              <span style="color: white; font-size: 24px; font-weight: bold;">S</span>
            </div>
            <h1 style="color: #2563eb; margin: 0;">Verify Your Email Address</h1>
          </div>
          
          <p>Hi ${userName},</p>
          <p>Thank you for signing up for SociallyHub! To complete your registration and start managing your social media accounts, please verify your email address.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: 600;">
              Verify Email Address
            </a>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              <strong>Security Note:</strong> This verification link will expire in 24 hours for security reasons. If you didn't create an account with us, you can safely ignore this email.
            </p>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; word-break: break-all;">
            ${verificationUrl}
          </p>
          
          <p>Once verified, you'll be able to:</p>
          <ul style="color: #475569;">
            <li>Connect your social media accounts</li>
            <li>Create and schedule posts</li>
            <li>Access analytics and insights</li>
            <li>Collaborate with your team</li>
          </ul>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #64748b; font-size: 14px;">
            Best regards,<br>
            The SociallyHub Team
          </p>
        </div>
      `,
      text: `Hi ${userName}, thank you for signing up for SociallyHub! Please verify your email address by clicking this link: ${verificationUrl} (expires in 24 hours)`
    }

    await this.send(emailData)
  }
}

// Singleton instance for global use
export const emailService = new EmailService()