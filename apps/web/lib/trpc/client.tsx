"use client"

/**
 * tRPC + TanStack Query client (docs/trpc.md). Client components consume
 * /api/trpc through `useTRPC()`; the router is imported as a type only.
 */
import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client"
import { createTRPCContext } from "@trpc/tanstack-react-query"
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"

import type { AppRouter } from "@/server/trpc/root"

export type RouterOutputs = inferRouterOutputs<AppRouter>
export type RouterInputs = inferRouterInputs<AppRouter>

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()

function isAuthError(error: unknown) {
  return error instanceof TRPCClientError && (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED"
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !isAuthError(error) && failureCount < 1,
      },
      mutations: { retry: false },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

function apiUrl() {
  if (typeof window !== "undefined") return "/api/trpc"
  return `http://localhost:${process.env.PORT ?? 3000}/api/trpc`
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClient] = React.useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: apiUrl() })],
    }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
