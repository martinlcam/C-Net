"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Inline filename editor: Enter saves, blur/Escape cancels. */
export function InlineNameEdit({
  initial,
  onSubmit,
  onCancel,
  className,
}: {
  initial: string
  onSubmit: (name: string) => void
  onCancel: () => void
  className?: string
}) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const input = inputRef.current
      input?.focus()
      input?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [])

  function commit() {
    committedRef.current = true
    const trimmed = value.trim()
    if (trimmed && trimmed !== initial) onSubmit(trimmed)
    else onCancel()
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Enter") {
          e.preventDefault()
          commit()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          committedRef.current = true
          onCancel()
        }
      }}
      onBlur={() => {
        if (committedRef.current) {
          committedRef.current = false
          return
        }
        onCancel()
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        "min-w-0 flex-1 rounded border border-neutral-40 bg-white px-1.5 py-0.5 font-medium text-neutral-100 text-sm outline-none focus:border-neutral-80 focus:ring-1 focus:ring-neutral-40",
        className
      )}
    />
  )
}
