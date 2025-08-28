"use client"

import { ReactNode } from "react"
import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState } from "react"
import { LocaleProvider } from "@/contexts/locale-context"

interface ProvidersProps {
  children: ReactNode
}

// Create QueryClient outside of component to avoid hydration issues
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
})

let clientQueryClient: QueryClient | undefined = undefined
const getQueryClient = () => {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return createQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!clientQueryClient) clientQueryClient = createQueryClient()
    return clientQueryClient
  }
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient()

  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </SessionProvider>
      </QueryClientProvider>
    </LocaleProvider>
  )
}