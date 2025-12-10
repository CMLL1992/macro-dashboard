'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './card'

interface AccordionProps {
  title: string
  description?: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function Accordion({ title, description, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card className="bg-card border">
      <CardHeader 
        className="cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-foreground">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <svg 
            className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <>{children}</>
        </CardContent>
      )}
    </Card>
  )
}

