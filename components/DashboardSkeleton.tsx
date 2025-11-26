/**
 * Skeleton components for dashboard loading states
 * Prevents "invisible table" effect during data loading
 */

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </th>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </th>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </th>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </th>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            </th>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            </th>
            <th className="px-3 py-2 text-left">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-2">
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              </td>
              <td className="px-3 py-2">
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              </td>
              <td className="px-3 py-2">
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              </td>
              <td className="px-3 py-2">
                <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
              </td>
              <td className="px-3 py-2">
                <div className="h-4 w-12 bg-gray-100 rounded animate-pulse" />
              </td>
              <td className="px-3 py-2">
                <div className="h-4 w-10 bg-gray-100 rounded animate-pulse" />
              </td>
              <td className="px-4 py-2">
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RegimeSkeleton() {
  return (
    <section className="rounded-lg border bg-white p-6">
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-96 bg-gray-100 rounded animate-pulse mb-4" />
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-32 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>
      <div className="h-4 w-80 bg-gray-100 rounded animate-pulse mb-3" />
      <div className="flex flex-wrap items-center gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-6 w-48 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>
    </section>
  )
}

export function ScenariosSkeleton() {
  return (
    <section className="rounded-lg border bg-white p-6">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-3" />
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="border rounded p-3 bg-gray-50">
            <div className="h-5 w-64 bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-1" />
            <div className="h-4 w-80 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  )
}





