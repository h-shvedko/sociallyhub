import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto remove after duration
    const duration = toast.duration || 5000
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
    
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback({
    success: (message: string, title?: string) => addToast({ message, title, type: 'success' }),
    error: (message: string, title?: string) => addToast({ message, title, type: 'error' }),
    warning: (message: string, title?: string) => addToast({ message, title, type: 'warning' }),
    info: (message: string, title?: string) => addToast({ message, title, type: 'info' }),
  }, [addToast])

  return {
    toasts,
    toast,
    addToast,
    removeToast,
  }
}