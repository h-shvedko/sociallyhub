"use client"

import { useState, useEffect } from 'react'
import { LiveChatWidget } from './live-chat-widget'
import { ContactFormFallback } from './contact-form-fallback'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'

interface SupportStatus {
  isAvailable: boolean
  onlineAgents: number
  averageResponseTime: string
  queueSize: number
}

interface LiveChatInterfaceProps {
  isOpen: boolean
  onClose: () => void
}

export function LiveChatInterface({ isOpen, onClose }: LiveChatInterfaceProps) {
  const [supportStatus, setSupportStatus] = useState<SupportStatus | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      checkSupportStatus()
    }
  }, [isOpen])

  const checkSupportStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/support/agents/status')
      if (response.ok) {
        const status = await response.json()
        setSupportStatus(status)

        // Auto-fallback to contact form if no agents available
        if (!status.isAvailable) {
          setShowContactForm(true)
        }
      } else {
        // Fallback to contact form on error
        setShowContactForm(true)
      }
    } catch (error) {
      console.error('Failed to check support status:', error)
      // Fallback to contact form on error
      setShowContactForm(true)
    } finally {
      setLoading(false)
    }
  }

  const handleContactFormFallback = () => {
    setShowContactForm(true)
  }

  const handleContactFormSuccess = () => {
    // Auto-close after successful form submission
    setTimeout(() => {
      onClose()
    }, 3000)
  }

  const handleClose = () => {
    setShowContactForm(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0">
        <VisuallyHidden>
          <DialogTitle>Support Chat</DialogTitle>
          <DialogDescription>
            Connect with our support team for assistance
          </DialogDescription>
        </VisuallyHidden>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-blue-200 rounded-full"></div>
            </div>
            <span className="ml-3 text-gray-600">Connecting to support...</span>
          </div>
        ) : showContactForm ? (
          <ContactFormFallback
            onClose={handleClose}
            onSubmitSuccess={handleContactFormSuccess}
          />
        ) : (
          <LiveChatWidget
            isOpen={isOpen}
            onClose={handleClose}
            onContactForm={handleContactFormFallback}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}