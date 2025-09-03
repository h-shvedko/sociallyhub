import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SimpleLanding() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <nav className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary"></div>
            <span className="text-xl font-semibold text-foreground">SociallyHub</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>

        <section className="text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            Manage All Your 
            <span className="text-primary"> Social Media</span> 
            <br />in One Place
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your social media management with powerful scheduling, analytics, and team collaboration tools.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg">Start Free Trial</Button>
            <Button variant="outline" size="lg">Watch Demo</Button>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Unified Inbox</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Manage all your social media messages, comments, and mentions in one place.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Scheduling</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Plan and schedule posts across multiple platforms with AI-powered timing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Get detailed insights with cross-platform analytics and custom reports.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}