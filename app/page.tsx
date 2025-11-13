import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// CM11 Trading - Redirect to dashboard immediately
export default function HomePage() {
  redirect('/dashboard')
}
