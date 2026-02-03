'use client'

import { cn } from '@/components/ui/utils'

export type TimeHorizon = 'daily' | 'weekly' | 'monthly'

interface MacroOverviewTabsProps {
  activeTab: TimeHorizon
  onTabChange: (tab: TimeHorizon) => void
}

export default function MacroOverviewTabs({ activeTab, onTabChange }: MacroOverviewTabsProps) {
  const tabs: Array<{ id: TimeHorizon; label: string; description: string }> = [
    { id: 'daily', label: 'Diario', description: 'Cambios recientes y momentum' },
    { id: 'weekly', label: 'Semanal', description: 'Tendencias y confirmación' },
    { id: 'monthly', label: 'Mensual', description: 'Régimen dominante' },
  ]

  return (
    <div className="border-b border-border">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex flex-col items-start">
              <span>{tab.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{tab.description}</span>
            </div>
          </button>
        ))}
      </nav>
    </div>
  )
}
