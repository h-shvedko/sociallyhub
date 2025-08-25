"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const materialCardVariants = cva(
  "rounded-md-medium text-card-foreground transition-all duration-300",
  {
    variants: {
      variant: {
        elevated: "bg-md-surface-container shadow-md-level1 hover:shadow-md-level2 border border-md-outline-variant/20",
        filled: "bg-md-surface-variant shadow-md-level0 border border-md-outline-variant/30",
        outlined: "bg-md-surface border border-md-outline",
      },
      padding: {
        none: "",
        default: "p-6",
        sm: "p-4",
        lg: "p-8",
      }
    },
    defaultVariants: {
      variant: "elevated",
      padding: "default",
    },
  }
)

export interface MaterialCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof materialCardVariants> {}

const MaterialCard = React.forwardRef<HTMLDivElement, MaterialCardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(materialCardVariants({ variant, padding, className }))}
      {...props}
    />
  )
)
MaterialCard.displayName = "MaterialCard"

const MaterialCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2", className)}
    {...props}
  />
))
MaterialCardHeader.displayName = "MaterialCardHeader"

const MaterialCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-headline-small font-normal text-md-on-surface leading-none tracking-tight", className)}
    {...props}
  />
))
MaterialCardTitle.displayName = "MaterialCardTitle"

const MaterialCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body-medium text-md-on-surface-variant", className)}
    {...props}
  />
))
MaterialCardDescription.displayName = "MaterialCardDescription"

const MaterialCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
))
MaterialCardContent.displayName = "MaterialCardContent"

const MaterialCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
))
MaterialCardFooter.displayName = "MaterialCardFooter"

export { 
  MaterialCard, 
  MaterialCardHeader, 
  MaterialCardFooter, 
  MaterialCardTitle, 
  MaterialCardDescription, 
  MaterialCardContent,
  materialCardVariants
}