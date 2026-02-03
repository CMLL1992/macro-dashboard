/**
 * Macro Overlay Component
 * 
 * Muestra señales macro de trading:
 * - Dirección (long/short/neutral)
 * - Convicción (low/med/high)
 * - Banderas de riesgo
 * - Playbook notes
 * - No trade window si hay eventos cercanos
 */

'use client'

import React from 'react'
import type { MacroSignal } from '@/domain/macro-signals/engine'

interface MacroOverlayProps {
  signal: MacroSignal
  requestId?: string
  className?: string
}

export default function MacroOverlay({ signal, requestId, className = '' }: MacroOverlayProps) {
  const getBiasColor = (direction: MacroSignal['biasDirection']) => {
    switch (direction) {
      case 'long':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
      case 'short':
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const getConvictionColor = (conviction: MacroSignal['conviction']) => {
    switch (conviction) {
      case 'high':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
      case 'med':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
    }
  }

  const getRiskSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200'
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const biasLabel = {
    long: 'LONG',
    short: 'SHORT',
    neutral: 'NEUTRAL',
  }[signal.biasDirection]

  const convictionLabel = {
    high: 'Alta',
    med: 'Media',
    low: 'Baja',
  }[signal.conviction]

  // Determine primary state: NO_TRADE has precedence
  const isNoTrade = signal.action === 'NO_TRADE'
  const actionLabel = isNoTrade ? 'NO TRADE' : signal.action
  const actionColor = isNoTrade
    ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
    : getBiasColor(signal.biasDirection)

  return (
    <div className={`rounded-lg border p-4 space-y-4 ${className}`}>
      {/* Header: Action (NO_TRADE tiene precedencia) + Conviction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Primary Action State */}
          <div className={`px-3 py-1 rounded font-semibold text-sm border ${actionColor}`}>
            {actionLabel}
          </div>
          {/* Show bias direction only if not NO_TRADE */}
          {!isNoTrade && (
            <div className={`px-2 py-1 rounded text-xs ${getBiasColor(signal.biasDirection)}`}>
              {biasLabel}
            </div>
          )}
          <div className={`px-2 py-1 rounded text-xs ${getConvictionColor(signal.conviction)}`}>
            Convicción: {convictionLabel}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Score: {signal.score > 0 ? '+' : ''}{signal.score.toFixed(0)}
          </div>
        </div>
        {requestId && (
          <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">
            ID: {requestId.substring(0, 8)}...
          </div>
        )}
      </div>

      {/* NO_TRADE State (Principal) */}
      {isNoTrade && (
        <div className="rounded-lg border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="font-semibold text-red-800 dark:text-red-200">NO TRADE - Bloqueo Activo</span>
          </div>
          {signal.actionReason && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{signal.actionReason}</p>
          )}
          {signal.biasDirection !== 'neutral' && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
              Bias detectado: {signal.biasDirection.toUpperCase()}, pero bloqueado por riesgo
            </p>
          )}
        </div>
      )}

      {/* Risk Flags */}
      {signal.riskFlags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Banderas de Riesgo</h3>
          {signal.riskFlags.map((flag) => (
            <div
              key={flag.id}
              className={`rounded border p-2 text-sm ${getRiskSeverityColor(flag.severity)}`}
            >
              <div className="font-medium">{flag.message}</div>
              <div className="text-xs mt-1 opacity-80">{flag.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* Playbook Notes */}
      {signal.playbookNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Playbook</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {signal.playbookNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Time to Next Event */}
      {signal.timeToNextEvent && (
        <div className={`rounded-lg border p-3 ${
          signal.timeToNextEvent.status === 'blocked'
            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
            : signal.timeToNextEvent.status === 'warning'
            ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20'
            : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/20'
        }`}>
          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${
              signal.timeToNextEvent.status === 'blocked'
                ? 'text-red-800 dark:text-red-200'
                : signal.timeToNextEvent.status === 'warning'
                ? 'text-yellow-800 dark:text-yellow-200'
                : 'text-gray-800 dark:text-gray-200'
            }`}>
              Próximo evento alta: {signal.timeToNextEvent.eventName}
            </span>
            <span className={`font-semibold ${
              signal.timeToNextEvent.status === 'blocked'
                ? 'text-red-700 dark:text-red-300'
                : signal.timeToNextEvent.status === 'warning'
                ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              T-{signal.timeToNextEvent.minutes < 60
                ? `${signal.timeToNextEvent.minutes}m`
                : `${Math.floor(signal.timeToNextEvent.minutes / 60)}h ${signal.timeToNextEvent.minutes % 60}m`
              }
            </span>
          </div>
          {signal.timeToNextEvent.status === 'warning' && (
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              ⚠️ Reducir tamaño / No nuevas entradas
            </p>
          )}
        </div>
      )}

      {/* Execution Checklist */}
      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Checklist de Ejecución</h3>
        
        {/* Setup */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Setup</h4>
          <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
            <div>• Régimen: <strong>{signal.executionChecklist.setup.regime}</strong></div>
            <div>• USD Bias: <strong>{signal.executionChecklist.setup.usdBias}</strong></div>
            {signal.executionChecklist.setup.topDrivers.length > 0 && (
              <div>• Drivers: {signal.executionChecklist.setup.topDrivers.map(d => 
                `${d.name} ${d.direction === 'long' ? '↑' : d.direction === 'short' ? '↓' : '→'} (${(d.weight * 100).toFixed(0)}%)`
              ).join(', ')}</div>
            )}
            {signal.executionChecklist.setup.anchorCorrelation && (
              <div>• Correlación ancla: <strong>{signal.executionChecklist.setup.anchorCorrelation.symbol}</strong> {signal.executionChecklist.setup.anchorCorrelation.corr > 0 ? '+' : ''}{(signal.executionChecklist.setup.anchorCorrelation.corr * 100).toFixed(0)}%</div>
            )}
          </div>
        </div>

        {/* Blockers */}
        {signal.executionChecklist.blockers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Bloqueos</h4>
            {signal.executionChecklist.blockers.map((blocker) => (
              <div key={blocker.id} className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-2 text-xs">
                <div className="font-medium text-red-800 dark:text-red-200">{blocker.message}</div>
                <div className="text-red-600 dark:text-red-400 mt-1">→ {blocker.conditionToResolve}</div>
              </div>
            ))}
          </div>
        )}

        {/* Invalidation Conditions */}
        {signal.executionChecklist.invalidationConditions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Condiciones de Invalidación</h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
              {signal.executionChecklist.invalidationConditions.map((condition) => (
                <li key={condition.id}>{condition.condition}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Deltas desde último snapshot */}
      {signal.deltas && signal.deltas.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cambios desde último snapshot</h3>
          {signal.deltas.map((delta) => {
            const severityColor =
              delta.severity === 'hard_stop'
                ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                : delta.severity === 'error'
                ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200'
                : delta.severity === 'warning'
                ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200'

            return (
              <div key={delta.id} className={`rounded border p-2 text-xs ${severityColor}`}>
                <div className="font-medium">{delta.message}</div>
                {delta.context && Object.keys(delta.context).length > 0 && delta.severity === 'hard_stop' && typeof delta.context.action === 'string' && (
                  <div className="text-xs mt-1 opacity-80">
                    <span className="font-semibold">→ {delta.context.action}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Position Sizing Guidance (Fase 3.3) */}
      {signal.positionSizing && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Position Sizing</h3>
          <div className={`rounded-lg border p-3 ${
            signal.positionSizing.recommendedRiskUnits === 0
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
              : signal.positionSizing.recommendedRiskUnits <= 0.25
              ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20'
              : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">
                  Tamaño recomendado: <span className="text-lg">{signal.positionSizing.recommendedRiskUnits}R</span>
                </div>
                <div className="text-xs mt-1 opacity-80">{signal.positionSizing.reason}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Base: {signal.positionSizing.baseSize}R</div>
                {signal.positionSizing.reductionFactor < 1 && (
                  <div className="text-xs text-muted-foreground">
                    Reducción: {((1 - signal.positionSizing.reductionFactor) * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
            {signal.positionSizing.warnings.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/20">
                <div className="text-xs font-medium">Warnings que afectan sizing:</div>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                  {signal.positionSizing.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execution Plan (Fase 3.3) */}
      {signal.executionPlan && (
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plan de Ejecución</h3>
          
          {/* Entry Guidance */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3">
            <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-2">Entry Guidance</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">{signal.executionPlan.entryGuidance}</p>
          </div>

          {/* Invalidation Triggers */}
          {signal.executionPlan.invalidationTriggers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Triggers de Invalidación</h4>
              {signal.executionPlan.invalidationTriggers.map((trigger) => (
                <div key={trigger.id} className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-2 text-xs">
                  <div className="font-medium text-red-800 dark:text-red-200">Si: {trigger.trigger}</div>
                  <div className="text-red-600 dark:text-red-400 mt-1">→ {trigger.action}</div>
                </div>
              ))}
            </div>
          )}

          {/* Cancellation Conditions */}
          {signal.executionPlan.cancellationConditions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Condiciones de Cancelación</h4>
              {signal.executionPlan.cancellationConditions.map((condition) => (
                <div key={condition.id} className="rounded border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 p-2 text-xs">
                  <div className="font-medium text-orange-800 dark:text-orange-200">Si: {condition.condition}</div>
                  <div className="text-orange-600 dark:text-orange-400 mt-1">→ {condition.action}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cooldown State (Fase 3.3) */}
      {signal.cooldownState && signal.cooldownState.isActive && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cooldown Activo</h3>
          <div className="rounded-lg border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></div>
              <span className="font-semibold text-purple-800 dark:text-purple-200">Cooldown: {signal.cooldownState.reason}</span>
            </div>
            {signal.cooldownState.expiresAt && (
              <div className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                Expira: {new Date(signal.cooldownState.expiresAt).toLocaleString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: 'Europe/Madrid'
                })}
              </div>
            )}
            <div className="text-xs text-purple-700 dark:text-purple-300">
              <div className="font-medium mb-1">Condiciones para revalidar:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {signal.cooldownState.revalidationConditions.map((condition, idx) => (
                  <li key={idx}>{condition}</li>
                ))}
              </ul>
            </div>
            <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800 text-xs text-purple-600 dark:text-purple-400 italic">
              ⚠️ No re-entrar hasta que se cumplan las condiciones de revalidación (previene revenge trading)
            </div>
          </div>
        </div>
      )}

      {/* Rules of Engagement */}
      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reglas de Ejecución</h3>
        <div className="space-y-2 text-xs">
          {signal.action === 'NO_TRADE' && (
            <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-2 text-red-800 dark:text-red-200">
              <div className="font-medium">⚠️ NO TRADE activo</div>
              <div className="mt-1">Ocultar cualquier CTA de ejecución. Condiciones para desbloquear:</div>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {signal.executionChecklist.blockers.map((b) => (
                  <li key={b.id}>{b.conditionToResolve}</li>
                ))}
              </ul>
            </div>
          )}
          {signal.conviction === 'low' && signal.action !== 'NO_TRADE' && (
            <div className="rounded border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 p-2 text-yellow-800 dark:text-yellow-200">
              <div className="font-medium">Convicción baja</div>
              <div className="mt-1">Solo observación / Tamaño mínimo / Esperar confirmación PA</div>
            </div>
          )}
          {signal.riskFlags.filter(f => f.severity === 'high' || f.severity === 'medium').length > 2 && (
            <div className="rounded border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 p-2 text-orange-800 dark:text-orange-200">
              <div className="font-medium">Datos incompletos</div>
              <div className="mt-1">Múltiples warnings detectados → Reducir riesgo</div>
            </div>
          )}
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Confianza: {(signal.confidence * 100).toFixed(0)}%</span>
          <div className="flex items-center gap-1">
            <div
              className="h-2 rounded-full bg-gray-200 dark:bg-gray-700"
              style={{ width: '100px' }}
            >
              <div
                className={`h-2 rounded-full ${
                  signal.confidence > 0.7
                    ? 'bg-green-500'
                    : signal.confidence > 0.5
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${signal.confidence * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

