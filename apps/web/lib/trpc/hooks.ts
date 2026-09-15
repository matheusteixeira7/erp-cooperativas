"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

/**
 * After a mutation, every screen may be stale (a sale changes the dashboard,
 * the simulation, the month lock...). The dataset per cooperative is small, so
 * invalidating everything is simpler and safer than tracking dependencies.
 */
export function useInvalidateAll() {
  const queryClient = useQueryClient()
  return React.useCallback(() => queryClient.invalidateQueries(), [queryClient])
}
