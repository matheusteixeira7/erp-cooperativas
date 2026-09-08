import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  highlight = false,
  loading = false,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  highlight?: boolean
  loading?: boolean
  className?: string
}) {
  return (
    <Card className={cn(highlight && "border-primary/40 bg-primary/5", className)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <CardTitle className={cn("text-2xl tabular-nums", highlight && "text-3xl")}>{value}</CardTitle>
        )}
      </CardHeader>
      {hint && <CardContent className="text-xs text-muted-foreground">{loading ? <Skeleton className="h-4 w-24" /> : hint}</CardContent>}
    </Card>
  )
}
