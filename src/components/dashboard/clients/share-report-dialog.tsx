'use client'

// ADR-0020 Phase 1: share-link management dialog for a single client report.
// Talks to /api/client-reports/[id]/share-links (list/create) and
// /api/client-reports/[id]/share-links/[linkId] (revoke). The raw share URL is
// returned exactly once at creation and is never fetchable again, so it is
// surfaced immediately in a read-only input with an explicit one-time warning.

import React, { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Copy,
  Link2,
  Loader2,
  Lock,
  Trash2,
} from 'lucide-react'

interface ShareLinkSummary {
  id: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  viewCount: number
  lastAccessedAt: string | null
  hasPassword: boolean
  active: boolean
}

// Matches the in-repo useToast() `addToast` signature (src/hooks/use-toast.ts).
// The hook's convenience `toast` object is mistyped as `Function` upstream, so
// the properly-typed `addToast` is used instead.
type AddToast = (toast: {
  message: string
  title?: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}) => void

interface ShareReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: { id: string; name: string } | null
  addToast: AddToast
}

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'never', label: 'Never expires' },
] as const

export function ShareReportDialog({
  open,
  onOpenChange,
  report,
  addToast,
}: ShareReportDialogProps) {
  const [links, setLinks] = useState<ShareLinkSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [expiry, setExpiry] = useState<string>('30')
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<React.ReactNode | null>(null)

  const reportId = report?.id

  const fetchLinks = useCallback(async () => {
    if (!reportId) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/client-reports/${reportId}/share-links`)
      if (response.ok) {
        const data = await response.json()
        setLinks(data.shareLinks || [])
      } else {
        setLinks([])
      }
    } catch (error) {
      console.error('Error fetching share links:', error)
      setLinks([])
    } finally {
      setIsLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    if (open && reportId) {
      fetchLinks()
    }
    if (!open) {
      // Reset transient state when the dialog closes; the raw URL is shown
      // once and must not linger for the next report.
      setPassword('')
      setExpiry('30')
      setCreatedUrl(null)
      setFormError(null)
      setLinks([])
    }
  }, [open, reportId, fetchLinks])

  const handleCreate = async () => {
    if (!reportId) return
    setIsCreating(true)
    setFormError(null)
    try {
      const response = await fetch(`/api/client-reports/${reportId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(password ? { password } : {}),
          expiresInDays: expiry === 'never' ? null : parseInt(expiry, 10),
        }),
      })
      const data = await response.json().catch(() => null)

      if (response.status === 201 && data?.url) {
        setCreatedUrl(data.url)
        setPassword('')
        addToast({ message: 'Share link created', type: 'success' })
        fetchLinks()
      } else if (response.status === 409) {
        setFormError('Only completed reports with generated data can be shared.')
      } else if (response.status === 402) {
        setFormError(
          <>
            Your current plan does not include this feature.{' '}
            <a href="/dashboard/billing" className="font-medium underline">
              Upgrade on the billing page
            </a>{' '}
            to enable it.
          </>
        )
      } else {
        setFormError(data?.error || 'Failed to create share link. Please try again.')
      }
    } catch (error) {
      console.error('Error creating share link:', error)
      setFormError('Failed to create share link. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevoke = async (linkId: string) => {
    if (!reportId) return
    setRevokingId(linkId)
    try {
      const response = await fetch(
        `/api/client-reports/${reportId}/share-links/${linkId}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        addToast({ message: 'Share link revoked', type: 'success' })
        await fetchLinks()
      } else {
        const data = await response.json().catch(() => null)
        addToast({ message: data?.error || 'Failed to revoke share link', type: 'error' })
      }
    } catch (error) {
      console.error('Error revoking share link:', error)
      addToast({ message: 'Failed to revoke share link', type: 'error' })
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopy = async () => {
    if (!createdUrl) return
    try {
      await navigator.clipboard.writeText(createdUrl)
      addToast({ message: 'Link copied to clipboard', type: 'success' })
    } catch {
      addToast({
        message: 'Could not copy automatically — select the link text and copy it manually',
        type: 'error',
      })
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const linkStatus = (link: ShareLinkSummary) => {
    if (link.active) return { label: 'Active', className: 'bg-green-100 text-green-800' }
    if (link.revokedAt) return { label: 'Revoked', className: 'bg-gray-100 text-gray-800' }
    return { label: 'Expired', className: 'bg-orange-100 text-orange-800' }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="share-report-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share report
          </DialogTitle>
          <DialogDescription>
            Create secure view-only links for &quot;{report?.name}&quot;. Anyone with a
            link sees a frozen snapshot of the report — never live data. Links can be
            password-protected, expire automatically, and can be revoked at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {createdUrl && (
            <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800">Share link created</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createdUrl}
                  data-testid="share-url"
                  className="text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-green-700">
                Copy it now — this link is shown only once.
              </p>
            </div>
          )}

          {/* Create form */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Create a new link</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="share-password">Password (optional)</Label>
                <Input
                  id="share-password"
                  data-testid="share-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="No password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="share-expiry">Link expires</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger id="share-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError && (
              <p className="flex items-start gap-1 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={isCreating || !reportId}
              data-testid="create-share-link"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Create share link
            </Button>
          </div>

          {/* Existing links */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Existing links</p>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No share links yet. Create one above to share this report.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {links.map((link) => {
                  const status = linkStatus(link)
                  return (
                    <div
                      key={link.id}
                      data-testid="share-link-row"
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={status.className}>{status.label}</Badge>
                          {link.hasPassword && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              Password
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDate(link.createdAt)}
                          {' · '}
                          {link.expiresAt
                            ? `Expires ${formatDate(link.expiresAt)}`
                            : 'Never expires'}
                          {' · '}
                          {link.viewCount} view{link.viewCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      {link.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-red-600 hover:text-red-700"
                          data-testid="revoke-share-link"
                          onClick={() => handleRevoke(link.id)}
                          disabled={revokingId === link.id}
                        >
                          {revokingId === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1">Revoke</span>
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
