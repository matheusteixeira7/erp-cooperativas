"use client"

import * as React from "react"

type ShellContextValue = {
  detailLabel: string | undefined
  setDetailLabel: (label: string | undefined) => void
}

const ShellContext = React.createContext<ShellContextValue | null>(null)

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [detailLabel, setDetailLabel] = React.useState<string | undefined>(undefined)
  const value = React.useMemo(() => ({ detailLabel, setDetailLabel }), [detailLabel])
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell() {
  const context = React.useContext(ShellContext)
  if (!context) throw new Error("useShell must be used within ShellProvider")
  return context
}

/** Lets a detail page name itself in the breadcrumb. */
export function useDetailLabel(label: string | undefined) {
  const { setDetailLabel } = useShell()
  React.useEffect(() => {
    setDetailLabel(label)
    return () => setDetailLabel(undefined)
  }, [label, setDetailLabel])
}
