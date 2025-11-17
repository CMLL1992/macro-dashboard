import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Macro Dashboard</h1>
      <p className="text-muted-foreground mb-6">Bienvenido. Ve al dashboard.</p>
      <Link className="underline" href="/dashboard">Ir a /dashboard</Link>
    </main>
  )
}


