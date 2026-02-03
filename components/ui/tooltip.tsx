"use client"

import * as React from "react"
import { createPortal } from "react-dom"

type TooltipProviderProps = {
  children: React.ReactNode
  delayDuration?: number
}

const TooltipDelayContext = React.createContext<number>(150)

export function TooltipProvider({ children, delayDuration = 150 }: TooltipProviderProps) {
  return <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>
}

type TooltipContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  triggerRef: React.RefObject<HTMLElement>
  contentId: string
  delay: number
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

export function Tooltip({ children }: { children: React.ReactNode }) {
  const delay = React.useContext(TooltipDelayContext)
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement>(null)
  const contentId = React.useId()

  const value = React.useMemo(
    () => ({ open, setOpen, triggerRef, contentId, delay }),
    [open, contentId, delay],
  )

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>
}

type TooltipTriggerProps = {
  children: React.ReactElement
  asChild?: boolean
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  const ctx = React.useContext(TooltipContext)
  if (!ctx) throw new Error("TooltipTrigger must be used within Tooltip")

  const { setOpen, triggerRef, delay, contentId } = ctx
  const timerRef = React.useRef<number | null>(null)

  const clear = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const openWithDelay = () => {
    clear()
    timerRef.current = window.setTimeout(() => setOpen(true), delay)
  }

  const close = () => {
    clear()
    setOpen(false)
  }

  return React.cloneElement(children, {
    ref: (node: HTMLElement) => {
      ;(triggerRef as any).current = node
      const { ref } = children as any
      if (typeof ref === "function") ref(node)
      else if (ref && typeof ref === "object") ref.current = node
    },
    onMouseEnter: (e: any) => {
      children.props.onMouseEnter?.(e)
      openWithDelay()
    },
    onMouseLeave: (e: any) => {
      children.props.onMouseLeave?.(e)
      close()
    },
    onFocus: (e: any) => {
      children.props.onFocus?.(e)
      openWithDelay()
    },
    onBlur: (e: any) => {
      children.props.onBlur?.(e)
      close()
    },
    // Soporte táctil/click: toggle
    onClick: (e: any) => {
      children.props.onClick?.(e)
      setOpen((prev) => !prev)
    },
    "aria-describedby": contentId,
  })
}

type TooltipContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "bottom" | "top" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
}

export function TooltipContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  ...props
}: TooltipContentProps) {
  const ctx = React.useContext(TooltipContext)
  if (!ctx) throw new Error("TooltipContent must be used within Tooltip")

  const { open, setOpen, triggerRef, contentId } = ctx
  const [mounted, setMounted] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 })

  React.useEffect(() => setMounted(true), [])

  const compute = React.useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()

    let top = r.bottom + sideOffset
    let left = r.left

    if (side === "top") top = r.top - sideOffset
    if (side === "left") {
      top = r.top
      left = r.left - sideOffset
    }
    if (side === "right") {
      top = r.top
      left = r.right + sideOffset
    }

    if (align === "center") left = r.left + r.width / 2
    if (align === "end") left = r.right

    setPos({ top, left })
  }, [align, side, sideOffset, triggerRef])

  React.useEffect(() => {
    if (!open) return
    compute()
    const onScroll = () => compute()
    const onResize = () => compute()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onResize)
    }
  }, [open, compute])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (contentRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown, true)
    document.addEventListener("touchstart", onDown, true)
    return () => {
      document.removeEventListener("mousedown", onDown, true)
      document.removeEventListener("touchstart", onDown, true)
    }
  }, [open, setOpen, triggerRef])

  if (!open || !mounted) return null

  return createPortal(
    <div
      id={contentId}
      ref={contentRef}
      role="tooltip"
      className={`z-[9999] max-w-xs rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md ${className || ""}`}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform:
          side === "bottom"
            ? align === "center"
              ? "translate(-50%, 0)"
              : align === "end"
                ? "translate(-100%, 0)"
                : "translate(0, 0)"
            : side === "top"
              ? align === "center"
                ? "translate(-50%, -100%)"
                : align === "end"
                  ? "translate(-100%, -100%)"
                  : "translate(0, -100%)"
              : side === "left"
                ? "translate(-100%, 0)"
                : "translate(0, 0)",
      }}
      {...props}
    />
    ,
    document.body,
  )
}

