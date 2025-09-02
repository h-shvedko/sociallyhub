import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-foreground">Test Page</h1>
        
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Card Test</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This is a test to see if basic styling works. The background should be styled, 
                text should have proper colors, and this card should have proper shadows and borders.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button>Primary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="secondary">Secondary Button</Button>
          </div>

          <div className="p-4 bg-primary text-primary-foreground rounded-lg">
            Primary background with primary foreground text
          </div>

          <div className="p-4 bg-card text-card-foreground border rounded-lg">
            Card background with card foreground text
          </div>
        </div>

        <Link href="/" className="text-primary hover:underline">
          ← Back to Landing Page
        </Link>
      </div>
    </div>
  )
}