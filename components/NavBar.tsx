'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

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
            <span className="text-base font-semibold tracking-tight">CM11 Trading</span>
            <div className="hidden md:flex items-center gap-4">
              <span className="text-muted-foreground">Pre-market</span>
              <span className="text-muted-foreground">Liquidez</span>
              <span className="text-muted-foreground">Correlaciones</span>
              <span className="text-muted-foreground">Dashboard</span>
              <span className="text-muted-foreground">Programación</span>
              <span className="text-muted-foreground">Telegram</span>
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

  // Menú único: dashboard nuevo (sin legacy Calendario/Narrativas/Sesgos/Análisis/Notificaciones/Ayuda)
  const baseNavItems = [
    { href: '/pre-market', label: 'Pre-market' },
    { href: '/liquidez', label: 'Liquidez' },
    { href: '/correlations', label: 'Correlaciones' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/programacion', label: 'Programación' },
    { href: '/settings/telegram', label: 'Telegram' },
  ] as const

  // Build nav items dynamically (client-side only, after mount)
  const navItems: Array<{ href: string; label: string }> = [...baseNavItems]

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm font-medium">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-semibold tracking-tight hover:text-primary">
            CM11 Trading
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
          {mounted && <ThemeToggle />}
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
