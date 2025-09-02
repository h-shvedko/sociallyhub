"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const materialButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-label-large font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 duration-300",
  {
    variants: {
      variant: {
        filled: "bg-md-primary text-md-on-primary hover:bg-md-primary/90 shadow-md-level2 hover:shadow-md-level3",
        outlined: "border border-md-outline text-md-primary bg-transparent hover:bg-md-primary/10 hover:shadow-md-level1",
        text: "text-md-primary bg-transparent hover:bg-md-primary/10",
        elevated: "bg-md-surface-container text-md-primary shadow-md-level1 hover:shadow-md-level2 hover:bg-md-surface-container-high",
        tonal: "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 shadow-md-level1 hover:shadow-md-level2",
        fab: "bg-md-primary-container text-md-on-primary-container shadow-md-level3 hover:shadow-md-level4 rounded-md-large",
      },
      size: {
        default: "h-10 px-6 py-2 rounded-md-large",
        sm: "h-8 px-4 text-label-small rounded-md-medium", 
        lg: "h-12 px-8 text-label-large rounded-md-large",
        icon: "h-10 w-10 rounded-md-large",
        fab: "h-14 w-14 rounded-md-large",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  }
)

export interface MaterialButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof materialButtonVariants> {
  asChild?: boolean
}

const MaterialButton = React.forwardRef<HTMLButtonElement, MaterialButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(materialButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
MaterialButton.displayName = "MaterialButton"

export { MaterialButton, materialButtonVariants }