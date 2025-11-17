"use client";

import { useState } from 'react'

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs text-muted-foreground hover:text-foreground"
      >
        i
      </button>
      {open && (
        <div className="absolute left-1/2 z-50 mt-2 w-80 -translate-x-1/2 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
          <div className="space-y-2 whitespace-pre-line">{text}</div>
        </div>
      )}
    </span>
  )
}


