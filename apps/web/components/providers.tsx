"use client"

import { Toaster } from "@workspace/ui/components/toast"

import { SessionProvider } from "@/lib/session"
import { TRPCReactProvider } from "@/lib/trpc/client"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <SessionProvider>
        <Toaster timeout={4500}>{children}</Toaster>
      </SessionProvider>
    </TRPCReactProvider>
  )
}
