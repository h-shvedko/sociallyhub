import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-label-large font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95 hover:scale-105 touch-friendly",
  {
    variants: {
      variant: {
        // Material Design variants
        default: "bg-md-primary text-md-on-primary hover:bg-md-primary/90 shadow-md-level2 hover:shadow-md-level3 rounded-md-large",
        destructive: "bg-md-error text-md-on-error hover:bg-md-error/90 shadow-md-level2 hover:shadow-md-level3 rounded-md-large",
        outline: "border border-md-outline text-md-primary bg-transparent hover:bg-md-primary/10 hover:shadow-md-level1 rounded-md-large",
        secondary: "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 shadow-md-level1 hover:shadow-md-level2 rounded-md-large",
        ghost: "text-md-primary bg-transparent hover:bg-md-primary/10 rounded-md-large",
        link: "text-md-primary underline-offset-4 hover:underline bg-transparent",
        // Additional Material Design variants
        elevated: "bg-md-surface-container text-md-primary shadow-md-level1 hover:shadow-md-level2 hover:bg-md-surface-container-high rounded-md-large",
        tonal: "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 shadow-md-level1 hover:shadow-md-level2 rounded-md-large",
        filled: "bg-md-primary text-md-on-primary hover:bg-md-primary/90 shadow-md-level2 hover:shadow-md-level3 rounded-md-large",
        text: "text-md-primary bg-transparent hover:bg-md-primary/10 rounded-md-large",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 px-4 text-label-small",
        lg: "h-12 px-8 text-label-large",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
