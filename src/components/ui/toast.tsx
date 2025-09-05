'use client'

import React, { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Toast as ToastType } from '@/hooks/use-toast'

interface ToastProps {
  toast: ToastType
  onRemove: (id: string) => void
}

export function Toast({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, toast.duration || 5000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-300 shadow-green-100'
      case 'error':
        return 'bg-red-50 border-red-300 shadow-red-100'
      case 'warning':
        return 'bg-yellow-50 border-yellow-300 shadow-yellow-100'
      case 'info':
        return 'bg-blue-50 border-blue-300 shadow-blue-100'
      default:
        return 'bg-blue-50 border-blue-300 shadow-blue-100'
    }
  }

  return (
    <div className={`min-w-80 max-w-sm w-full shadow-lg rounded-lg pointer-events-auto border-2 ${getStyles()} transform transition-all duration-300 ease-in-out`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 flex-1 min-w-0">
            {toast.title && (
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {toast.title}
              </p>
            )}
            <p className="text-sm text-gray-700 leading-relaxed">
              {toast.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded"
              onClick={() => onRemove(toast.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastType[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-6 right-6 z-[9999] space-y-3 max-w-md">
      {toasts.map((toast) => (
        <div key={toast.id} className="animate-in slide-in-from-right-full duration-300">
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}