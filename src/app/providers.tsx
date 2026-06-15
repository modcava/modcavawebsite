'use client'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  }))

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: '#201b12',
              border: '1px solid #3a2e24',
              color: '#e8dece',
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  )
}
