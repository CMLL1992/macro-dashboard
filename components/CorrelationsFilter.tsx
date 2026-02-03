"use client"

type Category = 'all' | 'forex' | 'index' | 'commodity' | 'crypto'

interface CorrelationsFilterProps {
  onFilterChange: (category: Category) => void
  activeCategory: Category
}

export function CorrelationsFilter({ onFilterChange, activeCategory }: CorrelationsFilterProps) {
  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'forex', label: 'FX' },
    { key: 'index', label: 'Índices' },
    { key: 'commodity', label: 'Commodities' },
    { key: 'crypto', label: 'Crypto' },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Filtrar por:</span>
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onFilterChange(cat.key)}
          className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
            activeCategory === cat.key
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted border-border text-foreground'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
