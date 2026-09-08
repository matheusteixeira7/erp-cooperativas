import { Skeleton } from "@workspace/ui/components/skeleton"

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-2 p-2" aria-busy="true" aria-label="Carregando">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 w-2/3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`${r}-${c}`} className="h-8 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
