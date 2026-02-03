/**
 * Telegram Notifications Settings v1 — FROZEN (2026-01-28)
 * Página de configuración de notificaciones Telegram.
 * No es trading, no son señales, solo contexto macro y actualizaciones.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { validateTelegramConfig } from '@/lib/notifications/validation'
import { env } from '@/lib/env'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import TelegramSetupSteps from '@/components/TelegramSetupSteps'
import TelegramSettingsClient from '@/components/TelegramSettingsClient'
import TelegramPreview from '@/components/TelegramPreview'
import InfoTooltip from '@/components/InfoTooltip'

export default async function TelegramSettingsPage() {
  const validation = await validateTelegramConfig()
  const botToken = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID || env.TELEGRAM_TEST_CHAT_ID
  const isConnected = !!(botToken && chatId && validation.bot_ok && validation.chat_ok)
  const botUsername = env.TELEGRAM_BOT_USERNAME
  const chatIdMasked = chatId && chatId.length > 4 ? `***${chatId.slice(-4)}` : '—'

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          Telegram – Notificaciones
          <InfoTooltip text="Configura las notificaciones de Telegram para recibir resúmenes y alertas del sistema macro. No es trading, no son señales, solo contexto descriptivo." />
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Recibe resúmenes diarios (08:00), semanales (domingo 09:00) y alertas informativas automáticas. Resúmenes informativos; no son señales.
        </p>
      </div>

      {/* 1) Setup guiado en 3 pasos */}
      <TelegramSetupSteps botUsername={botUsername} isConnected={isConnected} />

      {/* Estado de conexión (servidor) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de conexión (servidor)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Estado:</span>
            {isConnected ? (
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                🟢 Conectado
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40">
                🔴 No conectado
              </Badge>
            )}
            {chatId && (
              <span className="text-sm text-muted-foreground font-mono">Chat ID: {chatIdMasked}</span>
            )}
            <span className="text-sm text-muted-foreground">
              Bot activo:{' '}
              {validation.bot_ok ? (
                <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40 ml-1">
                  Sí
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40 ml-1">
                  No
                </Badge>
              )}
            </span>
          </div>
          {validation.errors.length > 0 && (
            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
              {validation.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1 list-disc list-inside">
              {validation.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 2) Tus notificaciones — toggles (Diario 08:00 / Semanal Domingo 09:00 / post-dato) */}
      {isConnected && <TelegramSettingsClient />}

      {/* Bloque 3 — Qué se notificará */}
      <Card>
        <CardHeader>
          <CardTitle>Qué se notificará</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✔</span>
              <span>Cambios de régimen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✔</span>
              <span>Cambios de liquidez</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✔</span>
              <span>Publicaciones macro del CORE</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✔</span>
              <span>Cambios relevantes en correlaciones</span>
            </li>
            <li className="flex items-start gap-2 mt-4">
              <span className="text-red-600 dark:text-red-400">❌</span>
              <span>No señales</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 dark:text-red-400">❌</span>
              <span>No recomendaciones</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600 dark:text-red-400">❌</span>
              <span>No precios objetivo</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Vista previa (Daily / Weekly / Post-dato) */}
      <Card>
        <CardHeader>
          <CardTitle>Vista previa</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Plantillas de mensaje: resumen diario, semanal y alerta post-dato.
          </p>
        </CardHeader>
        <CardContent>
          <TelegramPreview />
        </CardContent>
      </Card>

      {/* Disclaimer final — mismo estilo que Pre-Market / Liquidez */}
      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        ℹ️ La información mostrada tiene carácter descriptivo y no constituye una recomendación de inversión.
        Las notificaciones son resúmenes macro informativos; no son señales de trading.
      </div>
    </main>
  )
}
