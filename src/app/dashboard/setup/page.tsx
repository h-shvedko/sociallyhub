import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { getPublicDemoConfig } from '@/lib/config/demo'

// SERVER component: demo credentials are NEVER hardcoded (ADR-0025 D2/D4).
// getPublicDemoConfig() reads the server-only DEMO_MODE flag and, only in demo
// mode, the credentials hint sourced from DEMO_USER_PASSWORD. Outside demo mode
// we show generic "contact your workspace owner" copy — no fabricated password.
export default function SetupPage() {
  const { demoMode, credentialsHint } = getPublicDemoConfig()

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

          {demoMode && credentialsHint ? (
            <div className="space-y-2">
              <p className="text-sm text-center">
                Sign out and sign back in with the demo account:
              </p>
              <div className="bg-muted p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Demo Credentials:</p>
                <p className="text-xs font-mono">{credentialsHint}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Contact your workspace owner for access.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button asChild>
              <a href="/auth/signout">
                Sign Out
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard">Back to Dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
