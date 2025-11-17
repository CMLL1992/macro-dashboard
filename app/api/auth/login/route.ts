import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_PASSWORD = '111992'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Contraseña requerida' },
        { status: 400 }
      )
    }

    if (password === ADMIN_PASSWORD) {
      // Set cookie with admin session (expires in 24 hours)
      const cookieStore = await cookies()
      cookieStore.set('admin_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      })

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { success: false, error: 'Contraseña incorrecta' },
        { status: 401 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error en el servidor' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get('admin_auth')
  
  return NextResponse.json({
    authenticated: authCookie?.value === 'authenticated'
  })
}

