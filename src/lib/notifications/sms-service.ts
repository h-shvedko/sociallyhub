import { SMSNotificationData } from './types'
import { ErrorLogger, PerformanceLogger, BusinessLogger } from '@/lib/middleware/logging'

export interface SMSServiceConfig {
  provider: 'twilio' | 'aws_sns' | 'mock'
  twilio?: {
    accountSid: string
    authToken: string
    fromNumber: string
  }
  awsSns?: {
    accessKeyId: string
    secretAccessKey: string
    region: string
  }
  maxRetries: number
  retryDelay: number
}

export class SMSService {
  private config: SMSServiceConfig
  private client: any = null

  constructor() {
    this.config = {
      provider: (process.env.SMS_PROVIDER as any) || 'mock',
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        fromNumber: process.env.TWILIO_FROM_NUMBER || ''
      },
      awsSns: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1'
      },
      maxRetries: 3,
      retryDelay: 2000
    }

    this.initializeClient()
  }

  private async initializeClient(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'twilio':
          await this.initializeTwilio()
          break
        case 'aws_sns':
          await this.initializeAWSSNS()
          break
        case 'mock':
          this.initializeMock()
          break
        default:
          throw new Error(`Unsupported SMS provider: ${this.config.provider}`)
      }

      BusinessLogger.logSystemEvent(
        'sms_service_initialized',
        { provider: this.config.provider }
      )

    } catch (error) {
      ErrorLogger.logExternalServiceError(
        this.config.provider,
        error as Error,
        { operation: 'initialize_sms_client' }
      )
    }
  }

  private async initializeTwilio(): Promise<void> {
    if (!this.config.twilio?.accountSid || !this.config.twilio?.authToken) {
      throw new Error('Twilio configuration missing')
    }

    try {
      const twilio = require('twilio')
      this.client = twilio(this.config.twilio.accountSid, this.config.twilio.authToken)
    } catch (error) {
      throw new Error('Twilio SDK not installed. Run: npm install twilio')
    }
  }

  private async initializeAWSSNS(): Promise<void> {
    if (!this.config.awsSns?.accessKeyId || !this.config.awsSns?.secretAccessKey) {
      throw new Error('AWS SNS configuration missing')
    }

    try {
      const AWS = require('aws-sdk')
      AWS.config.update({
        accessKeyId: this.config.awsSns.accessKeyId,
        secretAccessKey: this.config.awsSns.secretAccessKey,
        region: this.config.awsSns.region
      })
      this.client = new AWS.SNS()
    } catch (error) {
      throw new Error('AWS SDK not installed. Run: npm install aws-sdk')
    }
  }

  private initializeMock(): void {
    this.client = {
      send: async (data: SMSNotificationData) => {
        console.log('📱 Mock SMS sent:', {
          to: data.to,
          message: data.message,
          from: data.from
        })
        return { sid: `mock_${Date.now()}` }
      }
    }
  }

  async send(smsData: SMSNotificationData): Promise<void> {
    if (!this.client) {
      throw new Error('SMS service not initialized')
    }

    const timer = PerformanceLogger.startTimer('send_sms')

    let retryCount = 0
    while (retryCount <= this.config.maxRetries) {
      try {
        let result

        switch (this.config.provider) {
          case 'twilio':
            result = await this.sendTwilio(smsData)
            break
          case 'aws_sns':
            result = await this.sendAWSSNS(smsData)
            break
          case 'mock':
            result = await this.client.send(smsData)
            break
          default:
            throw new Error(`Unsupported SMS provider: ${this.config.provider}`)
        }

        BusinessLogger.logNotificationEvent(
          'sms_sent',
          'system',
          {
            provider: this.config.provider,
            to: this.maskPhoneNumber(smsData.to),
            messageLength: smsData.message.length,
            retryCount,
            messageId: result.sid || result.MessageId
          }
        )

        timer.end({
          success: true,
          provider: this.config.provider,
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
            this.config.provider,
            error as Error,
            {
              operation: 'send_sms',
              to: this.maskPhoneNumber(smsData.to),
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

  private async sendTwilio(smsData: SMSNotificationData): Promise<any> {
    return await this.client.messages.create({
      body: smsData.message,
      from: smsData.from || this.config.twilio?.fromNumber,
      to: smsData.to
    })
  }

  private async sendAWSSNS(smsData: SMSNotificationData): Promise<any> {
    const params = {
      Message: smsData.message,
      PhoneNumber: smsData.to,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        }
      }
    }

    return await this.client.publish(params).promise()
  }

  async sendBulk(messages: SMSNotificationData[]): Promise<void> {
    const timer = PerformanceLogger.startTimer('send_bulk_sms')

    try {
      const promises = messages.map(sms => this.send(sms))
      const results = await Promise.allSettled(promises)

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      BusinessLogger.logNotificationEvent(
        'bulk_sms_sent',
        'system',
        {
          provider: this.config.provider,
          total: messages.length,
          successful,
          failed
        }
      )

      timer.end({
        provider: this.config.provider,
        total: messages.length,
        successful,
        failed
      })

      // Log failed messages
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          ErrorLogger.logExternalServiceError(
            this.config.provider,
            result.reason,
            {
              operation: 'bulk_sms_failed',
              messageIndex: index,
              to: this.maskPhoneNumber(messages[index]?.to)
            }
          )
        }
      })

    } catch (error) {
      timer.end({ error: true })
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Send a test message to a dummy number (won't actually send)
      const testData: SMSNotificationData = {
        to: '+15555555555',
        message: 'Test connection'
      }

      if (this.config.provider === 'mock') {
        return true
      }

      // For real providers, we could validate credentials without sending
      // This is a simplified test
      return this.client !== null

    } catch (error) {
      ErrorLogger.logExternalServiceError(
        this.config.provider,
        error as Error,
        { operation: 'test_sms_connection' }
      )
      return false
    }
  }

  getConfig(): Omit<SMSServiceConfig, 'twilio' | 'awsSns'> {
    return {
      provider: this.config.provider,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    }
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length > 4) {
      return phoneNumber.slice(0, -4) + '****'
    }
    return '****'
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Utility methods for common SMS types
  async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    const smsData: SMSNotificationData = {
      to: phoneNumber,
      message: `Your SociallyHub verification code is: ${code}. This code expires in 10 minutes.`
    }

    await this.send(smsData)
  }

  async sendSecurityAlert(phoneNumber: string, alertMessage: string): Promise<void> {
    const smsData: SMSNotificationData = {
      to: phoneNumber,
      message: `Security Alert: ${alertMessage} - SociallyHub`
    }

    await this.send(smsData)
  }

  async sendCriticalNotification(phoneNumber: string, title: string, message: string): Promise<void> {
    const smsData: SMSNotificationData = {
      to: phoneNumber,
      message: `${title}: ${message} - Reply STOP to unsubscribe from SMS notifications.`
    }

    await this.send(smsData)
  }
}

// Singleton instance for global use
export const smsService = new SMSService()