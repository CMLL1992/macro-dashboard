import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Force immediate redirect - no rendering
export default function HomePage() {
  'use server'
  redirect('/dashboard')
}


// Force update 1763055338
