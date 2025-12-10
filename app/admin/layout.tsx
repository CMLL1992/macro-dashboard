import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth is now handled by middleware.ts
  // This layout just provides the UI structure

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin" className="text-lg font-semibold">
                Panel de Administración
              </Link>
              <nav className="hidden md:flex items-center gap-4 text-sm">
                <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                  General
                </Link>
                <Link href="/admin/notifications" className="text-muted-foreground hover:text-foreground">
                  Notificaciones
                </Link>
                <Link href="/admin/calendar" className="text-muted-foreground hover:text-foreground">
                  Calendario
                </Link>
                <Link href="/admin/pmi" className="text-muted-foreground hover:text-foreground">
                  PMI
                </Link>
                <Link href="/admin/news" className="text-muted-foreground hover:text-foreground">
                  Noticias
                </Link>
              </nav>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>
      </div>
      <main className="max-w-7xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}

