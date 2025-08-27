import { io, Socket } from 'socket.io-client'
import { NotificationData, NotificationPreferences, WebSocketMessage } from './types'
import { SecurityLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

export interface WebSocketConfig {
  url: string
  reconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
  timeout: number
}

export interface ConnectionState {
  connected: boolean
  reconnecting: boolean
  lastConnected: Date | null
  failedAttempts: number
  latency: number
}

export type ConnectionCallback = (state: ConnectionState) => void
export type NotificationCallback = (notification: NotificationData) => void
export type ErrorCallback = (error: Error) => void

export class WebSocketManager {
  private socket: Socket | null = null
  private config: WebSocketConfig
  private connectionState: ConnectionState
  private connectionCallbacks: Set<ConnectionCallback> = new Set()
  private notificationCallbacks: Set<NotificationCallback> = new Set()
  private errorCallbacks: Set<ErrorCallback> = new Set()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private userId: string | null = null
  private workspaceId: string | null = null

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3099',
      reconnectAttempts: 5,
      reconnectDelay: 2000,
      heartbeatInterval: 30000,
      timeout: 5000,
      ...config
    }

    this.connectionState = {
      connected: false,
      reconnecting: false,
      lastConnected: null,
      failedAttempts: 0,
      latency: 0
    }

    // Auto-reconnect when page becomes visible
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.connectionState.connected) {
          this.connect()
        }
      })
    }
  }

  // Connection Management
  async connect(userId?: string, workspaceId?: string): Promise<void> {
    if (this.socket?.connected) {
      return
    }

    if (userId) this.userId = userId
    if (workspaceId) this.workspaceId = workspaceId

    if (!this.userId) {
      throw new Error('User ID is required for WebSocket connection')
    }

    const timer = PerformanceLogger.startTimer('websocket_connection')

    try {
      this.socket = io(this.config.url, {
        timeout: this.config.timeout,
        transports: ['websocket', 'polling'],
        auth: {
          userId: this.userId,
          workspaceId: this.workspaceId
        }
      })

      this.setupEventHandlers()
      
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'))
          return
        }

        const connectTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, this.config.timeout)

        this.socket.once('connect', () => {
          clearTimeout(connectTimeout)
          resolve()
        })

        this.socket.once('connect_error', (error) => {
          clearTimeout(connectTimeout)
          reject(error)
        })
      })

      timer.end({ success: true, userId: this.userId })
      
      SecurityLogger.logConnectionEvent(
        'websocket_connected',
        this.userId,
        { workspaceId: this.workspaceId }
      )

    } catch (error) {
      timer.end({ success: false, error: true })
      
      ErrorLogger.logExternalServiceError(
        'websocket',
        error as Error,
        { 
          userId: this.userId,
          workspaceId: this.workspaceId,
          operation: 'connect'
        }
      )

      this.handleConnectionError(error as Error)
      throw error
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.updateConnectionState({
      connected: false,
      reconnecting: false,
      lastConnected: this.connectionState.lastConnected
    })

    SecurityLogger.logConnectionEvent(
      'websocket_disconnected',
      this.userId || 'unknown'
    )
  }

  // Event Subscription
  onConnection(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback)
    // Immediately call with current state
    callback(this.connectionState)
    
    return () => {
      this.connectionCallbacks.delete(callback)
    }
  }

  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback)
    return () => {
      this.notificationCallbacks.delete(callback)
    }
  }

  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback)
    return () => {
      this.errorCallbacks.delete(callback)
    }
  }

  // Message Sending
  async sendMessage(type: string, data: any): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected')
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      userId: this.userId!,
      workspaceId: this.workspaceId || undefined
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not available'))
        return
      }

      this.socket.emit('message', message, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve()
        } else {
          reject(new Error(response.error || 'Message send failed'))
        }
      })
    })
  }

  // Notification-specific methods
  async subscribeToNotifications(preferences: NotificationPreferences): Promise<void> {
    await this.sendMessage('subscribe_notifications', preferences)
  }

  async unsubscribeFromNotifications(types: string[]): Promise<void> {
    await this.sendMessage('unsubscribe_notifications', { types })
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.sendMessage('mark_notification_read', { notificationId })
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.sendMessage('mark_all_notifications_read', {})
  }

  // Utility methods
  getConnectionState(): ConnectionState {
    return { ...this.connectionState }
  }

  isConnected(): boolean {
    return this.connectionState.connected
  }

  // Private methods
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.updateConnectionState({
        connected: true,
        reconnecting: false,
        lastConnected: new Date(),
        failedAttempts: 0
      })

      this.startHeartbeat()
    })

    this.socket.on('disconnect', (reason) => {
      this.updateConnectionState({
        connected: false,
        reconnecting: false
      })

      this.stopHeartbeat()

      SecurityLogger.logConnectionEvent(
        'websocket_disconnect',
        this.userId || 'unknown',
        { reason }
      )

      // Auto-reconnect for certain disconnect reasons
      if (['io server disconnect', 'io client disconnect'].includes(reason)) {
        this.scheduleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error)
    })

    this.socket.on('notification', (notification: NotificationData) => {
      this.notificationCallbacks.forEach(callback => {
        try {
          callback(notification)
        } catch (error) {
          ErrorLogger.logUnexpectedError(error as Error, {
            context: 'notification_callback',
            notificationId: notification.id
          })
        }
      })
    })

    this.socket.on('pong', (timestamp: number) => {
      const latency = Date.now() - timestamp
      this.updateConnectionState({
        latency
      })
    })

    this.socket.on('error', (error) => {
      this.errorCallbacks.forEach(callback => {
        try {
          callback(error)
        } catch (err) {
          ErrorLogger.logUnexpectedError(err as Error, {
            context: 'error_callback'
          })
        }
      })
    })
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', Date.now())
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private handleConnectionError(error: Error): void {
    this.updateConnectionState({
      connected: false,
      failedAttempts: this.connectionState.failedAttempts + 1
    })

    ErrorLogger.logExternalServiceError(
      'websocket',
      error,
      { 
        userId: this.userId,
        workspaceId: this.workspaceId,
        failedAttempts: this.connectionState.failedAttempts
      }
    )

    if (this.connectionState.failedAttempts < this.config.reconnectAttempts) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.connectionState.reconnecting) {
      return
    }

    this.updateConnectionState({
      reconnecting: true
    })

    const delay = this.config.reconnectDelay * Math.pow(2, this.connectionState.failedAttempts)

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null
      
      try {
        await this.connect()
      } catch (error) {
        // Error already handled in connect method
      }
    }, delay)
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates }
    
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(this.connectionState)
      } catch (error) {
        ErrorLogger.logUnexpectedError(error as Error, {
          context: 'connection_callback'
        })
      }
    })
  }
}

// Singleton instance for global use
export const websocketManager = new WebSocketManager()