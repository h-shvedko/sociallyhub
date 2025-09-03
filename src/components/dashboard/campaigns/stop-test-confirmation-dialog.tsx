'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface StopTestConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  testName: string
  loading?: boolean
}

export function StopTestConfirmationDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  testName,
  loading = false
}: StopTestConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Stop A/B Test</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Are you sure you want to stop &quot;<strong>{testName}</strong>&quot;? 
            This action cannot be undone and will mark the test as completed.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          <div className="text-sm text-muted-foreground">
            <strong>What happens when you stop this test:</strong>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Test status will change to &quot;Completed&quot;</li>
            <li>• No new participants will be included</li>
            <li>• Current results will be preserved</li>
            <li>• You can still view test analytics</li>
          </ul>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Stopping...
              </>
            ) : (
              'Stop Test'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}