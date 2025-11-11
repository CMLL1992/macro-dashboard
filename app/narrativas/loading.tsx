export default function NarrativasLoading() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="h-8 w-64 bg-muted/50 rounded animate-pulse" />
        <div className="mt-2 h-4 w-80 bg-muted/40 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-5 w-24 bg-muted/50 rounded animate-pulse" />
              <div className="h-5 w-16 bg-muted/50 rounded-full animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-muted/40 rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 bg-muted/40 rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted/50 rounded-full animate-pulse" />
              </div>
              <div className="h-3 w-32 bg-muted/30 rounded animate-pulse" />
              <div className="h-3 w-28 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}


