'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Workspace Setup Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">
            Your account needs to be associated with a workspace to access templates.
          </p>
          <div className="space-y-2">
            <p className="text-sm">Please try:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Sign out and sign back in with demo credentials</li>
              <li>• Email: demo@sociallyhub.com</li>
              <li>• Password: demo123456</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.href = '/auth/signout'}>
              Sign Out
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}