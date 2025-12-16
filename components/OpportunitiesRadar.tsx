'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { OpportunityPair } from '@/domain/macro-engine/opportunities'

type OpportunitiesRadarProps = {
  opportunities: OpportunityPair[]
}

export default function OpportunitiesRadar({ opportunities }: OpportunitiesRadarProps) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Radar de Oportunidades</CardTitle>
          <CardDescription>Top 5 pares para operar hoy</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay oportunidades claras en este momento. Revisa más tarde.
          </p>
        </CardContent>
      </Card>
    )
  }

  const getActionBadgeVariant = (action: string) => {
    return action === 'Long' ? 'default' : 'destructive'
  }

  const getConfidenceColor = (confidence: string) => {
    if (confidence === 'Alta') return 'text-emerald-600 dark:text-emerald-400'
    if (confidence === 'Media') return 'text-yellow-600 dark:text-yellow-400'
    return 'text-muted-foreground'
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Radar de Oportunidades</CardTitle>
        <CardDescription>Top {opportunities.length} pares para operar hoy</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Par</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Confianza</TableHead>
              <TableHead>Razonamiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((opp, idx) => (
              <TableRow key={opp.symbol}>
                <TableCell className="font-medium">{opp.symbol}</TableCell>
                <TableCell>
                  <Badge variant={getActionBadgeVariant(opp.action)}>
                    {opp.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={cn('font-semibold', getConfidenceColor(opp.confidence))}>
                    {opp.confidence}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {opp.reasoning}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Basado en sesgos tácticos, correlaciones y relevancia macro. 
            Revisa la página <strong>Sesgos</strong> para más detalles.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}







