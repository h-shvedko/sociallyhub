"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionContextValue {
  openItems: Set<string>
  toggleItem: (value: string) => void
  type: "single" | "multiple"
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  type: "single" | "multiple"
  collapsible?: boolean
  className?: string
  children: React.ReactNode
  defaultValue?: string | string[]
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
}

export function Accordion({
  type,
  collapsible = false,
  className,
  children,
  defaultValue,
  value,
  onValueChange,
}: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(() => {
    if (defaultValue) {
      return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue])
    }
    return new Set()
  })

  const controlledOpenItems = React.useMemo(() => {
    if (value !== undefined) {
      return new Set(Array.isArray(value) ? value : [value])
    }
    return openItems
  }, [value, openItems])

  const toggleItem = React.useCallback((itemValue: string) => {
    if (value !== undefined && onValueChange) {
      // Controlled mode
      if (type === "single") {
        const currentValue = Array.isArray(value) ? value[0] : value
        const newValue = currentValue === itemValue ? "" : itemValue
        onValueChange(newValue)
      } else {
        const currentValues = Array.isArray(value) ? value : [value].filter(Boolean)
        const newValues = currentValues.includes(itemValue)
          ? currentValues.filter(v => v !== itemValue)
          : [...currentValues, itemValue]
        onValueChange(newValues)
      }
    } else {
      // Uncontrolled mode
      setOpenItems(prev => {
        const newSet = new Set(prev)
        if (type === "single") {
          if (newSet.has(itemValue)) {
            if (collapsible) {
              newSet.delete(itemValue)
            }
          } else {
            newSet.clear()
            newSet.add(itemValue)
          }
        } else {
          if (newSet.has(itemValue)) {
            newSet.delete(itemValue)
          } else {
            newSet.add(itemValue)
          }
        }
        return newSet
      })
    }
  }, [type, collapsible, value, onValueChange])

  const contextValue = React.useMemo(
    () => ({
      openItems: controlledOpenItems,
      toggleItem,
      type,
    }),
    [controlledOpenItems, toggleItem, type]
  )

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

function useAccordion() {
  const context = React.useContext(AccordionContext)
  if (!context) {
    throw new Error("useAccordion must be used within an Accordion")
  }
  return context
}

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}

// Context for AccordionItem to pass value to triggers and content
interface AccordionItemContextValue {
  value: string
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null)

export function AccordionItem({ value, className, children }: AccordionItemProps) {
  const contextValue = React.useMemo(() => ({ value }), [value])
  
  return (
    <AccordionItemContext.Provider value={contextValue}>
      <div className={cn("border-b", className)} data-value={value}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

interface AccordionTriggerProps {
  className?: string
  children: React.ReactNode
}

export function AccordionTrigger({ className, children }: AccordionTriggerProps) {
  const { openItems, toggleItem } = useAccordion()
  const itemElement = React.useContext(AccordionItemContext)
  
  if (!itemElement?.value) {
    throw new Error("AccordionTrigger must be used within an AccordionItem")
  }

  const isOpen = openItems.has(itemElement.value)

  return (
    <button
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
      onClick={() => toggleItem(itemElement.value)}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </button>
  )
}

interface AccordionContentProps {
  className?: string
  children: React.ReactNode
}

export function AccordionContent({ className, children }: AccordionContentProps) {
  const { openItems } = useAccordion()
  const itemElement = React.useContext(AccordionItemContext)
  
  if (!itemElement?.value) {
    throw new Error("AccordionContent must be used within an AccordionItem")
  }

  const isOpen = openItems.has(itemElement.value)

  return (
    <div
      className={cn(
        "overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
      style={{
        display: isOpen ? "block" : "none"
      }}
    >
      <div className="pb-4 pt-0">{children}</div>
    </div>
  )
}