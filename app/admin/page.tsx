import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated()
  
  if (!authenticated) {
    redirect('/admin/login')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
        <p className="text-muted-foreground">
          Configuración completa del dashboard y sistema de notificaciones
        </p>
      </div>

      {/* Secciones principales */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Configuración General */}
        <Link href="/admin" className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Configuración General</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Variables de entorno, configuración del sistema y estado general
          </p>
          <div className="text-xs text-muted-foreground">
            Ver estado del sistema, variables de entorno y configuración base
          </div>
        </Link>

        {/* Notificaciones Telegram */}
        <Link href="/admin/notifications" className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Notificaciones Telegram</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configurar bot de Telegram, chats, y sistema de notificaciones
          </p>
          <div className="text-xs text-muted-foreground">
            Configurar bot token, chat IDs, tests, y ajustes de notificaciones
          </div>
        </Link>

        {/* Calendario Macroeconómico */}
        <Link href="/admin/calendar" className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Calendario Macroeconómico</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Gestionar eventos del calendario económico y previsiones
          </p>
          <div className="text-xs text-muted-foreground">
            Ver, agregar y editar eventos del calendario macroeconómico
          </div>
        </Link>

        {/* PMI Manufacturero */}
        <Link href="/admin/pmi" className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">PMI Manufacturero</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Insertar valores del ISM Manufacturing PMI manualmente
          </p>
          <div className="text-xs text-muted-foreground">
            Agregar valores del PMI cuando se publiquen mensualmente
          </div>
        </Link>

        {/* Noticias */}
        <Link href="/admin/news" className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Noticias</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Gestionar noticias y eventos económicos publicados
          </p>
          <div className="text-xs text-muted-foreground">
            Ver historial de noticias, insertar nuevas y gestionar deduplicación
          </div>
        </Link>

        {/* Dashboard */}
        <Link href="/admin/dashboard" className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configuración del dashboard principal y visualizaciones
          </p>
          <div className="text-xs text-muted-foreground">
            Ajustar visualizaciones, sesgos macro y correlaciones
          </div>
        </Link>

        {/* Base de Datos */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-2">Base de Datos</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Estado de la base de datos y operaciones de mantenimiento
          </p>
          <div className="text-xs text-muted-foreground mb-4">
            Ver estadísticas, tablas y estado de la base de datos SQLite
          </div>
          <Link 
            href="/api/health" 
            target="_blank"
            className="text-sm text-primary hover:underline"
          >
            Ver estado de la BD →
          </Link>
        </div>
      </div>

      {/* Estado del Sistema */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Estado del Sistema</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Variables de Entorno</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">NODE_ENV:</span>
                <span className="font-mono">{process.env.NODE_ENV || 'no definido'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">APP_URL:</span>
                <span className="font-mono text-xs">{process.env.APP_URL || 'no definido'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TIMEZONE:</span>
                <span className="font-mono">{process.env.TIMEZONE || 'Europe/Madrid'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telegram habilitado:</span>
                <span className={process.env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true' ? 'text-green-600' : 'text-red-600'}>
                  {process.env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true' ? 'Sí' : 'No'}
                </span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Accesos Rápidos</h3>
            <div className="space-y-2">
              <Link 
                href="/api/health" 
                target="_blank"
                className="block text-sm text-primary hover:underline"
              >
                Health Check API
              </Link>
              <Link 
                href="/api/notifications/verify" 
                target="_blank"
                className="block text-sm text-primary hover:underline"
              >
                Verificar Notificaciones
              </Link>
              <Link 
                href="/dashboard" 
                className="block text-sm text-primary hover:underline"
              >
                Ver Dashboard Principal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Información de Seguridad */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h2 className="text-lg font-semibold text-yellow-900 mb-2">Seguridad</h2>
        <p className="text-sm text-yellow-800 mb-2">
          Este panel está protegido con contraseña. Solo usuarios autorizados pueden acceder.
        </p>
        <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
          <li>La contraseña se almacena de forma segura y no se expone en el código</li>
          <li>Las sesiones expiran después de 24 horas</li>
          <li>Los cambios en este panel afectan a todo el sistema</li>
          <li>Compartir la URL pública no permite modificar configuraciones sin la contraseña</li>
        </ul>
      </div>
    </div>
  )
}
