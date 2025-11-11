'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

type SmartTooltipProps = {
  content: React.ReactNode
  children: React.ReactNode
  delay?: number
  closeDelay?: number
  placement?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
  id?: string
}

export default function SmartTooltip({
  content,
  children,
  delay = 175,
  closeDelay = 275,
  placement = 'top',
  maxWidth = 320,
  id,
}: SmartTooltipProps) {
  const [open, setOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0, placement: placement as string })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipId = id || `tooltip-${Math.random().toString(36).substr(2, 9)}`

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const padding = 12
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let x = 0
    let y = 0
    let finalPlacement = placement

    // Estimar tamaño del tooltip si aún no se ha medido
    const estimatedWidth = tooltipRect.width || maxWidth
    const estimatedHeight = tooltipRect.height || 200

    // Calcular posición inicial según placement preferido
    if (placement === 'top') {
      x = triggerRect.left + triggerRect.width / 2
      y = triggerRect.top - padding
      // Flip si no hay espacio arriba
      if (triggerRect.top < estimatedHeight + padding) {
        finalPlacement = 'bottom'
        y = triggerRect.bottom + padding
      }
    } else if (placement === 'bottom') {
      x = triggerRect.left + triggerRect.width / 2
      y = triggerRect.bottom + padding
      // Flip si no hay espacio abajo
      if (viewportHeight - triggerRect.bottom < estimatedHeight + padding) {
        finalPlacement = 'top'
        y = triggerRect.top - padding
      }
    } else if (placement === 'left') {
      x = triggerRect.left - padding
      y = triggerRect.top + triggerRect.height / 2
      // Flip si no hay espacio a la izquierda
      if (triggerRect.left < estimatedWidth + padding) {
        finalPlacement = 'right'
        x = triggerRect.right + padding
      }
    } else {
      x = triggerRect.right + padding
      y = triggerRect.top + triggerRect.height / 2
      // Flip si no hay espacio a la derecha
      if (viewportWidth - triggerRect.right < estimatedWidth + padding) {
        finalPlacement = 'left'
        x = triggerRect.left - padding
      }
    }

    // Shift: desplazar para que no toque bordes (usar tamaño real si está disponible)
    const tooltipWidth = tooltipRect.width || estimatedWidth
    const tooltipHeight = tooltipRect.height || estimatedHeight

    if (finalPlacement === 'top' || finalPlacement === 'bottom') {
      // Centrar horizontalmente, pero ajustar si se sale
      if (x - tooltipWidth / 2 < padding) {
        x = padding + tooltipWidth / 2
      } else if (x + tooltipWidth / 2 > viewportWidth - padding) {
        x = viewportWidth - padding - tooltipWidth / 2
      }
    } else {
      // Centrar verticalmente, pero ajustar si se sale
      if (y - tooltipHeight / 2 < padding) {
        y = padding + tooltipHeight / 2
      } else if (y + tooltipHeight / 2 > viewportHeight - padding) {
        y = viewportHeight - padding - tooltipHeight / 2
      }
    }

    setPosition({ x, y, placement: finalPlacement })
  }, [placement, maxWidth])

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      if (!locked) {
        setOpen(true)
        // Calcular posición después de que el tooltip se renderice (usar requestAnimationFrame para mejor sincronización)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            calculatePosition()
          })
        })
      }
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (locked) return

    closeTimeoutRef.current = setTimeout(() => {
      if (!locked) {
        setOpen(false)
      }
    }, closeDelay)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (locked) {
      setLocked(false)
      setOpen(false)
    } else {
      setLocked(true)
      setOpen(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculatePosition()
        })
      })
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (locked) {
      setLocked(false)
      setOpen(false)
    } else {
      setLocked(true)
      setOpen(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculatePosition()
        })
      })
    }
  }

  // Tecla Esc para cerrar
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && locked) {
        setLocked(false)
        setOpen(false)
      }
    }
    if (locked) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [locked])

  // Recalcular posición en scroll y resize
  useEffect(() => {
    if (open) {
      const handleScroll = () => calculatePosition()
      const handleResize = () => calculatePosition()
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [open, calculatePosition])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const getTooltipStyle = (): React.CSSProperties => {
    const { x, y, placement: finalPlacement } = position
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      zIndex: 60,
      maxWidth: `${maxWidth}px`,
      pointerEvents: 'auto',
    }

    if (finalPlacement === 'top') {
      return { ...baseStyle, transform: 'translate(-50%, calc(-100% - 12px))' }
    } else if (finalPlacement === 'bottom') {
      return { ...baseStyle, transform: 'translate(-50%, 12px)' }
    } else if (finalPlacement === 'left') {
      return { ...baseStyle, transform: 'translate(calc(-100% - 12px), -50%)' }
    } else {
      return { ...baseStyle, transform: 'translate(12px, -50%)' }
    }
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex items-center cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        aria-describedby={open ? tooltipId : undefined}
        role="button"
        tabIndex={0}
      >
        {children}
        {locked && (
          <span className="ml-1 text-xs text-primary" aria-label="Tooltip anclado">📌</span>
        )}
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
          style={getTooltipStyle()}
          onMouseEnter={() => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
          }}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2 whitespace-pre-line break-words">{content}</div>
          {locked && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              Presiona Esc para cerrar
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

