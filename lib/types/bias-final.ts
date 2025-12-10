import { z } from 'zod'

export const TrendFinalEnum = z.enum(['Alcista', 'Bajista', 'Neutral', 'Rango'])
export type TrendFinal = z.infer<typeof TrendFinalEnum>

export const ActionFinalEnum = z.enum(['Buscar compras', 'Buscar ventas', 'Rango/táctico'])
export type ActionFinal = z.infer<typeof ActionFinalEnum>

export const ConfidenceLevelEnum = z.enum(['Alta', 'Media', 'Baja'])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelEnum>

export const BiasRowFinalSchema = z.object({
  symbol: z.string().min(1),
  trend_final: TrendFinalEnum,
  action_final: ActionFinalEnum,
  confidence_level: ConfidenceLevelEnum,
  motivo_macro: z.string().min(1),
  corr_ref: z.string().min(1),
  corr_12m: z.union([z.number().finite(), z.null()]).transform(val => val ?? 0),
  corr_3m: z.union([z.number().finite(), z.null()]).transform(val => val ?? 0),
})
export type BiasRowFinal = z.infer<typeof BiasRowFinalSchema>

export function validateBiasRowFinal(input: unknown): { ok: true; data: BiasRowFinal } | { ok: false; error: string } {
  const parsed = BiasRowFinalSchema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  return { ok: false, error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }
}


