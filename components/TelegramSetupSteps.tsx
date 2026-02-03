'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STORAGE_KEY_CHAT_ID = 'telegram_chat_id_pref'

type TelegramSetupStepsProps = {
  botUsername: string | undefined
  isConnected: boolean
}

export default function TelegramSetupSteps({ botUsername, isConnected }: TelegramSetupStepsProps) {
  const [chatId, setChatId] = useState('')
  const [savedChatId, setSavedChatId] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [saveFeedback, setSaveFeedback] = useState(false)

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CHAT_ID) : null
      if (stored) {
        setChatId(stored)
        setSavedChatId(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleSaveConnect = () => {
    const trimmed = chatId.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(STORAGE_KEY_CHAT_ID, trimmed)
      setSavedChatId(trimmed)
      setSaveFeedback(true)
      setTimeout(() => setSaveFeedback(false), 3000)
    } catch {
      setSaveFeedback(false)
    }
  }

  const handleSendTest = async () => {
    const targetChatId = chatId.trim() || savedChatId
    if (!targetChatId) {
      setTestResult({ type: 'error', message: 'Indica tu Chat ID arriba y guarda, o configura TELEGRAM_CHAT_ID en el servidor.' })
      return
    }
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setTestResult({ type: 'success', message: 'Mensaje de prueba enviado. Revisa tu móvil.' })
      } else {
        setTestResult({
          type: 'error',
          message: data.details || data.error || 'Error al enviar. Revisa Chat ID y token del bot.',
        })
      }
    } catch (err) {
      setTestResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error de red.',
      })
    } finally {
      setTestLoading(false)
    }
  }

  const telegramLink = botUsername
    ? `https://t.me/${botUsername.replace(/^@/, '')}`
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-lg">📘</span>
          Configura Telegram en 3 pasos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paso 1 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Paso 1 — Abrir el bot en Telegram
          </p>
          {botUsername ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">@{botUsername.replace(/^@/, '')}</span>
              <a
                href={telegramLink!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Abrir en Telegram
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Configura TELEGRAM_BOT_USERNAME en el servidor para mostrar el enlace al bot.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Pulsa Start en Telegram para iniciar la conversación.
          </p>
        </div>

        {/* Paso 2 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Paso 2 — Obtener tu Chat ID
          </p>
          <p className="text-sm text-muted-foreground">
            Opción A (ideal): el bot responde automáticamente con tu Chat ID al comando /start o /id.
          </p>
          <p className="text-xs text-muted-foreground">
            Opción B: escribe /id en el bot y copia el número que te devuelve.
          </p>
        </div>

        {/* Paso 3 — Pegar Chat ID y guardar / Enviar prueba */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Paso 3 — Pegar Chat ID y guardar
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              placeholder="Ej: 123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="max-w-xs font-mono text-sm"
              aria-label="Chat ID de Telegram"
            />
            <Button onClick={handleSaveConnect} variant="outline" size="md">
              Guardar y conectar
            </Button>
            {saveFeedback && (
              <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                ✓ Guardado
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado en servidor:{' '}
            {isConnected ? (
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                Conectado
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40">
                No conectado
              </Badge>
            )}
          </p>

          {/* Botón Enviar mensaje de prueba */}
          <div className="pt-3 border-t border-border space-y-2">
            <Button
              onClick={handleSendTest}
              disabled={testLoading}
              size="md"
            >
              {testLoading ? 'Enviando...' : 'Enviar mensaje de prueba'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Verifica que recibes notificaciones en tu móvil.
            </p>
            {testResult && (
              <p
                className={
                  testResult.type === 'success'
                    ? 'text-sm text-green-600 dark:text-green-400'
                    : 'text-sm text-red-600 dark:text-red-400'
                }
              >
                {testResult.type === 'success' ? '✓ ' : '✗ '}
                {testResult.message}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
