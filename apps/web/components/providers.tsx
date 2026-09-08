"use client"

import { Toaster } from "@workspace/ui/components/toast"

import { DemoProvider } from "@/lib/demo/store"
import { SessionProvider } from "@/lib/demo/session"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DemoProvider>
        <Toaster timeout={4500}>{children}</Toaster>
      </DemoProvider>
    </SessionProvider>
  )
}
