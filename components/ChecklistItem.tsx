'use client'

import { useState } from 'react'

export default function ChecklistItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false)

  return (
    <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="accent-emerald-500 w-5 h-5 cursor-pointer"
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}













