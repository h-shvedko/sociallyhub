"use client"

import * as React from "react"
import { MaterialButton } from "@/components/ui/material-button"
import { MaterialInput } from "@/components/ui/material-input"
import { MaterialCard, MaterialCardHeader, MaterialCardTitle, MaterialCardDescription, MaterialCardContent } from "@/components/ui/material-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Palette, 
  Download, 
  Heart, 
  Settings, 
  Send,
  Star,
  Bookmark,
  Share,
  ThumbsUp
} from "lucide-react"

export function MaterialDesignShowcase() {
  const [inputValue, setInputValue] = React.useState("")

  return (
    <div className="space-y-12 p-6 bg-md-background min-h-screen">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-display-medium font-normal text-md-on-background">
          Material Design 3.0 Showcase
        </h1>
        <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
          Experience the beautiful Material Design components with proper elevation, typography, and animations
        </p>
      </div>

      {/* Material Buttons Section */}
      <MaterialCard className="animate-slide-up" style={{animationDelay: '100ms'}}>
        <MaterialCardHeader>
          <MaterialCardTitle>Material Design Buttons</MaterialCardTitle>
          <MaterialCardDescription>
            Various button styles following Material Design 3.0 principles
          </MaterialCardDescription>
        </MaterialCardHeader>
        <MaterialCardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <h4 className="text-title-medium font-medium text-md-on-surface">Primary Actions</h4>
              <div className="space-y-2">
                <MaterialButton variant="filled" className="w-full">
                  <Download className="h-4 w-4" />
                  Filled Button
                </MaterialButton>
                <MaterialButton variant="elevated" className="w-full">
                  <Settings className="h-4 w-4" />
                  Elevated Button
                </MaterialButton>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-title-medium font-medium text-md-on-surface">Secondary Actions</h4>
              <div className="space-y-2">
                <MaterialButton variant="tonal" className="w-full">
                  <Heart className="h-4 w-4" />
                  Tonal Button
                </MaterialButton>
                <MaterialButton variant="outlined" className="w-full">
                  <Send className="h-4 w-4" />
                  Outlined Button
                </MaterialButton>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-title-medium font-medium text-md-on-surface">Tertiary Actions</h4>
              <div className="space-y-2">
                <MaterialButton variant="text" className="w-full">
                  <Share className="h-4 w-4" />
                  Text Button
                </MaterialButton>
                <MaterialButton variant="fab" size="fab">
                  <Star className="h-5 w-5" />
                </MaterialButton>
              </div>
            </div>
          </div>
        </MaterialCardContent>
      </MaterialCard>

      {/* Enhanced Buttons Section */}
      <MaterialCard className="animate-slide-up" style={{animationDelay: '200ms'}}>
        <MaterialCardHeader>
          <MaterialCardTitle>Enhanced Button Styles</MaterialCardTitle>
          <MaterialCardDescription>
            Updated shadcn/ui buttons with Material Design styling
          </MaterialCardDescription>
        </MaterialCardHeader>
        <MaterialCardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Button variant="default">Primary</Button>
              <Button variant="tonal">Tonal</Button>
            </div>
            <div className="space-y-2">
              <Button variant="outline">Outlined</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="space-y-2">
              <Button variant="secondary">Secondary</Button>
              <Button variant="elevated">Elevated</Button>
            </div>
            <div className="space-y-2">
              <Button variant="destructive">Error</Button>
              <Button variant="text">Text</Button>
            </div>
          </div>
        </MaterialCardContent>
      </MaterialCard>

      {/* Material Inputs Section */}
      <MaterialCard className="animate-slide-up" style={{animationDelay: '300ms'}}>
        <MaterialCardHeader>
          <MaterialCardTitle>Material Design Inputs</MaterialCardTitle>
          <MaterialCardDescription>
            Form components with floating labels and proper state management
          </MaterialCardDescription>
        </MaterialCardHeader>
        <MaterialCardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <MaterialInput
                label="Outlined Input"
                variant="outlined"
                placeholder="Enter your text"
                supportingText="Supporting text for additional information"
              />
              <MaterialInput
                label="Email Address"
                variant="outlined"
                type="email"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                supportingText="We'll never share your email"
              />
              <MaterialInput
                label="Password"
                variant="outlined"
                type="password"
                error
                errorText="Password must be at least 8 characters"
              />
            </div>
            
            <div className="space-y-4">
              <MaterialInput
                label="Filled Input"
                variant="filled"
                placeholder="Enter your text"
                supportingText="This is a filled input style"
              />
              <MaterialInput
                label="Large Input"
                variant="outlined"
                size="lg"
                placeholder="Large size input"
              />
              <MaterialInput
                label="Small Input"
                variant="filled"
                size="sm"
                placeholder="Small size input"
              />
            </div>
          </div>
        </MaterialCardContent>
      </MaterialCard>

      {/* Elevation and Cards */}
      <div className="grid gap-6 md:grid-cols-3 animate-slide-up" style={{animationDelay: '400ms'}}>
        <MaterialCard variant="elevated">
          <MaterialCardHeader>
            <MaterialCardTitle>Elevated Card</MaterialCardTitle>
            <MaterialCardDescription>Shadow level 1 elevation</MaterialCardDescription>
          </MaterialCardHeader>
          <MaterialCardContent>
            <p className="text-body-medium text-md-on-surface-variant">
              This card uses elevation to create depth and hierarchy.
            </p>
          </MaterialCardContent>
        </MaterialCard>

        <MaterialCard variant="filled">
          <MaterialCardHeader>
            <MaterialCardTitle>Filled Card</MaterialCardTitle>
            <MaterialCardDescription>Surface variant background</MaterialCardDescription>
          </MaterialCardHeader>
          <MaterialCardContent>
            <p className="text-body-medium text-md-on-surface-variant">
              This card uses background color for differentiation.
            </p>
          </MaterialCardContent>
        </MaterialCard>

        <MaterialCard variant="outlined">
          <MaterialCardHeader>
            <MaterialCardTitle>Outlined Card</MaterialCardTitle>
            <MaterialCardDescription>Border outline style</MaterialCardDescription>
          </MaterialCardHeader>
          <MaterialCardContent>
            <p className="text-body-medium text-md-on-surface-variant">
              This card uses outline borders for definition.
            </p>
          </MaterialCardContent>
        </MaterialCard>
      </div>

      {/* Typography Scale */}
      <MaterialCard className="animate-scale-in" style={{animationDelay: '500ms'}}>
        <MaterialCardHeader>
          <MaterialCardTitle>Material Design Typography</MaterialCardTitle>
          <MaterialCardDescription>
            The complete Material Design 3.0 type scale
          </MaterialCardDescription>
        </MaterialCardHeader>
        <MaterialCardContent className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-display-large">Display Large</h1>
            <h2 className="text-display-medium">Display Medium</h2>
            <h3 className="text-display-small">Display Small</h3>
          </div>
          <div className="space-y-2">
            <h4 className="text-headline-large">Headline Large</h4>
            <h5 className="text-headline-medium">Headline Medium</h5>
            <h6 className="text-headline-small">Headline Small</h6>
          </div>
          <div className="space-y-2">
            <p className="text-title-large">Title Large</p>
            <p className="text-title-medium">Title Medium</p>
            <p className="text-title-small">Title Small</p>
          </div>
          <div className="space-y-2">
            <p className="text-body-large">Body Large - This is for longer form writing as it works well for extended reading.</p>
            <p className="text-body-medium">Body Medium - This is for shorter form writing or UI copy.</p>
            <p className="text-body-small">Body Small - This is for captions or overlines.</p>
          </div>
          <div className="space-y-2">
            <p className="text-label-large">Label Large</p>
            <p className="text-label-medium">Label Medium</p>
            <p className="text-label-small">Label Small</p>
          </div>
        </MaterialCardContent>
      </MaterialCard>

      {/* Interactive Elements */}
      <MaterialCard className="animate-fade-in" style={{animationDelay: '600ms'}}>
        <MaterialCardHeader>
          <MaterialCardTitle>Interactive Elements</MaterialCardTitle>
          <MaterialCardDescription>
            Badges and interactive components with Material Design styling
          </MaterialCardDescription>
        </MaterialCardHeader>
        <MaterialCardContent>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-md-primary-container text-md-on-primary-container">Primary</Badge>
            <Badge className="bg-md-secondary-container text-md-on-secondary-container">Secondary</Badge>
            <Badge className="bg-md-tertiary-container text-md-on-tertiary-container">Tertiary</Badge>
            <Badge className="bg-md-error-container text-md-on-error-container">Error</Badge>
            <Badge className="bg-md-surface-variant text-md-on-surface-variant">Surface</Badge>
          </div>
          
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="ghost" size="icon" className="ripple state-layer">
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="ripple state-layer">
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="ripple state-layer">
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </MaterialCardContent>
      </MaterialCard>
    </div>
  )
}