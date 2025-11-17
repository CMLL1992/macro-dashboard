'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Mount component only on client after hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR, render only a stable placeholder
  // This ensures server and client HTML match during hydration
  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm font-medium">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold tracking-tight">🦅 Macro Dashboard</span>
            <div className="hidden md:flex items-center gap-4">
              <span className="text-muted-foreground">📊 Dashboard</span>
              <span className="text-muted-foreground">🔗 Correlaciones</span>
              <span className="text-muted-foreground">📝 Narrativas</span>
              <span className="text-muted-foreground">❓ Ayuda</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">FRED</span>
            <span className="text-muted-foreground">GitHub</span>
          </div>
        </nav>
      </header>
    )
  }

  // After hydration, render the actual navigation
  const baseNavItems = [
    { href: '/dashboard', label: '📊 Dashboard' },
    { href: '/correlations', label: '🔗 Correlaciones' },
    { href: '/narrativas', label: '📝 Narrativas' },
    { href: '/ayuda', label: '❓ Ayuda' },
  ] as const

  // Build nav items dynamically (client-side only, after mount)
  const navItems: Array<{ href: string; label: string }> = [...baseNavItems]
  
  // Only check test flag in client after mount (we're already in client here)
  if (process.env.NEXT_PUBLIC_ENABLE_TELEGRAM_TESTS === 'true') {
    navItems.push({ href: '/admin', label: '⚙️ Admin' })
    // Notificaciones, Noticias y Calendario se gestionan automáticamente, no se muestran en NavBar
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm font-medium">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-semibold tracking-tight hover:text-primary">
            🦅 Macro Dashboard
          </Link>
          <div className="hidden md:flex items-center gap-4">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={`transition-colors ${
                    active ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="https://fred.stlouisfed.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary"
          >
            FRED
          </Link>
          <Link
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary"
          >
            GitHub
          </Link>
        </div>
      </nav>
    </header>
  )
}
