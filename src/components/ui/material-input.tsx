"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const materialInputVariants = cva(
  "flex w-full border border-md-outline bg-md-surface-container-highest text-md-on-surface text-body-large file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-md-on-surface-variant focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300",
  {
    variants: {
      variant: {
        outlined: "border-2 border-md-outline focus:border-md-primary hover:border-md-on-surface-variant rounded-md-small px-4 py-3",
        filled: "bg-md-surface-variant border-0 border-b-2 border-md-on-surface-variant focus:border-md-primary rounded-t-md-small px-4 py-3 pb-2",
      },
      size: {
        default: "h-12",
        sm: "h-10 text-body-medium",
        lg: "h-14 text-body-large",
      },
    },
    defaultVariants: {
      variant: "outlined",
      size: "default",
    },
  }
)

export interface MaterialInputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof materialInputVariants> {
  label?: string
  supportingText?: string
  error?: boolean
  errorText?: string
}

const MaterialInput = React.forwardRef<HTMLInputElement, MaterialInputProps>(
  ({ className, variant, size, label, supportingText, error, errorText, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(false)

    React.useEffect(() => {
      setHasValue(!!props.value || !!props.defaultValue)
    }, [props.value, props.defaultValue])

    return (
      <div className="relative w-full">
        {/* Label */}
        {label && (
          <label
            className={cn(
              "absolute transition-all duration-300 text-md-on-surface-variant pointer-events-none",
              variant === "outlined" && (focused || hasValue 
                ? "top-[-8px] left-3 text-label-small bg-md-surface-container-highest px-1" 
                : "top-3 left-4 text-body-large"
              ),
              variant === "filled" && (focused || hasValue 
                ? "top-1 left-4 text-label-small" 
                : "top-3 left-4 text-body-large"
              ),
              focused && "text-md-primary",
              error && "text-md-error"
            )}
          >
            {label}
          </label>
        )}

        {/* Input */}
        <input
          className={cn(
            materialInputVariants({ variant, size }),
            className,
            error && "border-md-error focus:border-md-error",
            label && variant === "filled" && "pt-6"
          )}
          ref={ref}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            setHasValue(!!e.target.value)
            props.onBlur?.(e)
          }}
          onChange={(e) => {
            setHasValue(!!e.target.value)
            props.onChange?.(e)
          }}
          {...props}
        />

        {/* Supporting/Error Text */}
        {(supportingText || errorText) && (
          <p className={cn(
            "mt-1 text-label-medium",
            error ? "text-md-error" : "text-md-on-surface-variant"
          )}>
            {error && errorText ? errorText : supportingText}
          </p>
        )}
      </div>
    )
  }
)

MaterialInput.displayName = "MaterialInput"

export { MaterialInput, materialInputVariants }