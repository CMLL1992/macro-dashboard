import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Macro Dashboard',
  description: 'Dashboard macroeconómico',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // RootLayout is 100% deterministic - no conditional logic
  // No client-side values, no flags, no dynamic content
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NavBar />
        <main className="pt-4">{children}</main>
      </body>
    </html>
  )
}
