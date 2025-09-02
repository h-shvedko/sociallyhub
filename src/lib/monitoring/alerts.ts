import { AppLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Alerting System
 * Monitors application health and sends notifications for critical events
 */

export interface AlertRule {
  id: string
  name: string
  condition: AlertCondition
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  channels: AlertChannel[]
  throttleMinutes: number
  metadata?: any
}

export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'pattern' | 'error_rate'
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  value: number
  timeWindow: number // minutes
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min'
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'sms'
  config: any
  enabled: boolean
}

export interface Alert {
  id: string
  ruleId: string
  severity: string
  title: string
  description: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  metadata: any
}

export class AlertingSystem {
  private static rules: Map<string, AlertRule> = new Map()
  private static activeAlerts: Map<string, Alert> = new Map()
  private static lastAlertTimes: Map<string, Date> = new Map()

  /**
   * Initialize alerting system with default rules
   */
  static initialize() {
    this.loadDefaultRules()
    this.startMonitoring()
    AppLogger.info('Alerting system initialized')
  }

  /**
   * Add or update alert rule
   */
  static addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule)
    AppLogger.info('Alert rule added', {
      type: 'alert_rule_added',
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity
    })
  }

  /**
   * Remove alert rule
   */
  static removeRule(ruleId: string) {
    this.rules.delete(ruleId)
    AppLogger.info('Alert rule removed', {
      type: 'alert_rule_removed',
      ruleId
    })
  }

  /**
   * Check all rules and trigger alerts if needed
   */
  static async checkRules() {
    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue

      try {
        const shouldAlert = await this.evaluateRule(rule)
        if (shouldAlert && !this.isThrottled(ruleId, rule.throttleMinutes)) {
          await this.triggerAlert(rule)
          this.lastAlertTimes.set(ruleId, new Date())
        }
      } catch (error) {
        AppLogger.error('Failed to evaluate alert rule', error as Error, {
          ruleId: rule.id,
          ruleName: rule.name
        })
      }
    }
  }

  /**
   * Evaluate if a rule condition is met
   */
  private static async evaluateRule(rule: AlertRule): Promise<boolean> {
    const { condition } = rule
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - condition.timeWindow * 60 * 1000)

    let value: number = 0

    switch (condition.type) {
      case 'threshold':
        value = await this.getMetricValue(condition.metric, startTime, endTime, condition.aggregation)
        break
      
      case 'error_rate':
        value = await this.calculateErrorRate(startTime, endTime)
        break
      
      case 'anomaly':
        value = await this.detectAnomaly(condition.metric, startTime, endTime)
        break
      
      default:
        return false
    }

    return this.evaluateCondition(value, condition.operator, condition.value)
  }

  /**
   * Get metric value for time range
   */
  private static async getMetricValue(
    metric: string, 
    startTime: Date, 
    endTime: Date, 
    aggregation: string = 'count'
  ): Promise<number> {
    try {
      switch (metric) {
        case 'api_requests':
          // Count API requests from logs
          // For now, return a mock value - would integrate with actual metrics storage
          return Math.floor(Math.random() * 1000)
        
        case 'error_count':
          // Count errors from logs
          return Math.floor(Math.random() * 10)
        
        case 'response_time':
          // Get average response time
          return Math.floor(Math.random() * 2000)
        
        default:
          return 0
      }
    } catch (error) {
      AppLogger.error('Failed to get metric value', error as Error, {
        metric,
        startTime,
        endTime
      })
      return 0
    }
  }

  /**
   * Calculate error rate percentage
   */
  private static async calculateErrorRate(startTime: Date, endTime: Date): Promise<number> {
    // This would integrate with actual metrics
    const totalRequests = Math.floor(Math.random() * 1000) + 100
    const errorRequests = Math.floor(Math.random() * 50)
    return (errorRequests / totalRequests) * 100
  }

  /**
   * Detect anomalies in metrics
   */
  private static async detectAnomaly(metric: string, startTime: Date, endTime: Date): Promise<number> {
    // Simple anomaly detection - would implement more sophisticated algorithms
    const currentValue = await this.getMetricValue(metric, startTime, endTime)
    const historicalAvg = currentValue * (0.8 + Math.random() * 0.4) // Mock historical average
    
    return Math.abs(currentValue - historicalAvg) / historicalAvg * 100
  }

  /**
   * Evaluate condition
   */
  private static evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'gte': return value >= threshold
      case 'lt': return value < threshold
      case 'lte': return value <= threshold
      case 'eq': return value === threshold
      default: return false
    }
  }

  /**
   * Check if alert is throttled
   */
  private static isThrottled(ruleId: string, throttleMinutes: number): boolean {
    const lastAlertTime = this.lastAlertTimes.get(ruleId)
    if (!lastAlertTime) return false
    
    const timeSinceLastAlert = Date.now() - lastAlertTime.getTime()
    return timeSinceLastAlert < throttleMinutes * 60 * 1000
  }

  /**
   * Trigger an alert
   */
  private static async triggerAlert(rule: AlertRule) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      severity: rule.severity,
      title: `${rule.name} Alert`,
      description: `Alert triggered for rule: ${rule.name}`,
      timestamp: new Date(),
      resolved: false,
      metadata: {
        rule: rule.name,
        condition: rule.condition
      }
    }

    this.activeAlerts.set(alert.id, alert)

    AppLogger.warn(`Alert triggered: ${alert.title}`, {
      type: 'alert_triggered',
      alertId: alert.id,
      ruleId: rule.id,
      severity: rule.severity,
      timestamp: alert.timestamp.toISOString()
    })

    // Send notifications through configured channels
    await this.sendNotifications(alert, rule.channels)

    // Persist alert to database
    await this.persistAlert(alert)
  }

  /**
   * Send notifications through configured channels
   */
  private static async sendNotifications(alert: Alert, channels: AlertChannel[]) {
    for (const channel of channels) {
      if (!channel.enabled) continue

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailAlert(alert, channel.config)
            break
          
          case 'webhook':
            await this.sendWebhookAlert(alert, channel.config)
            break
          
          case 'slack':
            await this.sendSlackAlert(alert, channel.config)
            break
          
          default:
            AppLogger.warn(`Unsupported alert channel type: ${channel.type}`)
        }
      } catch (error) {
        AppLogger.error('Failed to send alert notification', error as Error, {
          alertId: alert.id,
          channelType: channel.type
        })
      }
    }
  }

  /**
   * Send email alert (mock implementation)
   */
  private static async sendEmailAlert(alert: Alert, config: any) {
    AppLogger.info('Email alert sent', {
      type: 'email_alert',
      alertId: alert.id,
      to: config.to,
      subject: alert.title
    })
    // Would integrate with actual email service
  }

  /**
   * Send webhook alert
   */
  private static async sendWebhookAlert(alert: Alert, config: any) {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {})
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            timestamp: alert.timestamp.toISOString(),
            metadata: alert.metadata
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`)
      }

      AppLogger.info('Webhook alert sent', {
        type: 'webhook_alert',
        alertId: alert.id,
        url: config.url,
        status: response.status
      })
    } catch (error) {
      throw new Error(`Failed to send webhook alert: ${error}`)
    }
  }

  /**
   * Send Slack alert (mock implementation)
   */
  private static async sendSlackAlert(alert: Alert, config: any) {
    AppLogger.info('Slack alert sent', {
      type: 'slack_alert',
      alertId: alert.id,
      channel: config.channel
    })
    // Would integrate with Slack API
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string, resolvedBy?: string) {
    const alert = this.activeAlerts.get(alertId)
    if (!alert || alert.resolved) return

    alert.resolved = true
    alert.resolvedAt = new Date()
    alert.metadata.resolvedBy = resolvedBy

    AppLogger.info('Alert resolved', {
      type: 'alert_resolved',
      alertId,
      resolvedBy,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
    })

    // Update in database
    await this.updateAlert(alert)
  }

  /**
   * Get active alerts
   */
  static getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get alert history
   */
  static async getAlertHistory(limit: number = 100): Promise<Alert[]> {
    try {
      const alerts = await prisma.alert.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit
      })

      return alerts.map(alert => ({
        id: alert.id,
        ruleId: alert.ruleId,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
        resolvedAt: alert.resolvedAt,
        metadata: alert.metadata as any
      }))
    } catch (error) {
      AppLogger.error('Failed to get alert history', error as Error)
      return []
    }
  }

  /**
   * Persist alert to database
   */
  private static async persistAlert(alert: Alert) {
    try {
      await prisma.alert.create({
        data: {
          id: alert.id,
          ruleId: alert.ruleId,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          timestamp: alert.timestamp,
          resolved: alert.resolved,
          resolvedAt: alert.resolvedAt,
          metadata: alert.metadata
        }
      })
    } catch (error) {
      AppLogger.error('Failed to persist alert', error as Error, {
        alertId: alert.id
      })
    }
  }

  /**
   * Update alert in database
   */
  private static async updateAlert(alert: Alert) {
    try {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          resolved: alert.resolved,
          resolvedAt: alert.resolvedAt,
          metadata: alert.metadata,
          updatedAt: new Date()
        }
      })
    } catch (error) {
      AppLogger.error('Failed to update alert', error as Error, {
        alertId: alert.id
      })
    }
  }

  /**
   * Load default alert rules
   */
  private static loadDefaultRules() {
    // High error rate alert
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        type: 'error_rate',
        metric: 'error_rate',
        operator: 'gt',
        value: 5, // 5%
        timeWindow: 5
      },
      severity: 'high',
      enabled: true,
      throttleMinutes: 15,
      channels: [
        {
          type: 'webhook',
          config: { url: process.env.ALERT_WEBHOOK_URL || 'http://localhost:3000/api/alerts/webhook' },
          enabled: true
        }
      ]
    })

    // High response time alert
    this.addRule({
      id: 'high_response_time',
      name: 'High Response Time',
      condition: {
        type: 'threshold',
        metric: 'response_time',
        operator: 'gt',
        value: 2000, // 2 seconds
        timeWindow: 10,
        aggregation: 'avg'
      },
      severity: 'medium',
      enabled: true,
      throttleMinutes: 30,
      channels: [
        {
          type: 'webhook',
          config: { url: process.env.ALERT_WEBHOOK_URL || 'http://localhost:3000/api/alerts/webhook' },
          enabled: true
        }
      ]
    })

    // Database connection issues
    this.addRule({
      id: 'db_connection_errors',
      name: 'Database Connection Errors',
      condition: {
        type: 'threshold',
        metric: 'db_errors',
        operator: 'gt',
        value: 10,
        timeWindow: 5,
        aggregation: 'count'
      },
      severity: 'critical',
      enabled: true,
      throttleMinutes: 5,
      channels: [
        {
          type: 'webhook',
          config: { url: process.env.ALERT_WEBHOOK_URL || 'http://localhost:3000/api/alerts/webhook' },
          enabled: true
        }
      ]
    })
  }

  /**
   * Start monitoring loop
   */
  private static startMonitoring() {
    // Check rules every minute
    setInterval(() => {
      this.checkRules()
    }, 60 * 1000)

    AppLogger.info('Alert monitoring started')
  }
}

// Initialize alerting system
AlertingSystem.initialize()