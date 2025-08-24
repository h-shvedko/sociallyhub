"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { BarChart3, MessageCircle, PenTool, Users, Zap } from "lucide-react"

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Social Media
            <span className="text-primary"> Command Center</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Manage all your social media accounts from one powerful dashboard. 
            Post everywhere at once, manage your inbox, and analyze your performance.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg">
              <Link href="/auth/signin">
                Get Started
              </Link>
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto mt-32 max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <PenTool className="h-10 w-10 text-primary" />
                <CardTitle>One Post, All Platforms</CardTitle>
                <CardDescription>
                  Write once, publish everywhere. Customize content for each platform automatically.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <MessageCircle className="h-10 w-10 text-primary" />
                <CardTitle>Unified Inbox</CardTitle>
                <CardDescription>
                  All comments, mentions, and messages in one place. Never miss a conversation again.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary" />
                <CardTitle>Powerful Analytics</CardTitle>
                <CardDescription>
                  Track performance across all platforms with detailed insights and reporting.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary" />
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>
                  Work together with role-based permissions and approval workflows.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-primary" />
                <CardTitle>Smart Scheduling</CardTitle>
                <CardDescription>
                  Schedule posts for optimal engagement times across different time zones.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary" />
                <CardTitle>Multi-Client Support</CardTitle>
                <CardDescription>
                  Perfect for agencies managing multiple clients and their social presence.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="mx-auto mt-32 max-w-5xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Connect All Your Platforms
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Seamlessly integrate with all major social media platforms
          </p>
          <div className="mt-12 flex items-center justify-center gap-8 grayscale opacity-60">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-blue-500"></div>
              <span>Twitter</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-blue-600"></div>
              <span>Facebook</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-pink-500"></div>
              <span>Instagram</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-blue-700"></div>
              <span>LinkedIn</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-red-500"></div>
              <span>YouTube</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-black"></div>
              <span>TikTok</span>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mx-auto mt-32 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Ready to Transform Your Social Media Management?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands of businesses and agencies who trust SociallyHub to manage their social presence.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/auth/signin">
                Start Free Trial
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
