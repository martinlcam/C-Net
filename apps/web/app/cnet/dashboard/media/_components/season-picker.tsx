"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"
import type { Season } from "@/lib/media-api"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/stories/dropdown-menu/dropdown-menu"

const seasonLabel = (s: Season) => (s.seasonNumber === 0 ? "Specials" : `Season ${s.seasonNumber}`)

/**
 * Season chooser on the app's Radix dropdown. Escape closes just the menu: the event is
 * marked default-prevented so the dialog and player key handlers above leave it alone.
 */
export function SeasonPicker({
  seasons,
  value,
  onChange,
  tone = "light",
}: {
  seasons: Season[]
  value: string | null
  onChange: (id: string) => void
  tone?: "light" | "dark"
}) {
  const [open, setOpen] = useState(false)
  const current = seasons.find((s) => s.id === value)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Select season"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm outline-none transition-colors",
            tone === "dark"
              ? "border-white/20 bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:border-white/50"
              : "border-neutral-30 bg-white text-neutral-90 hover:bg-neutral-10 focus-visible:border-neutral-60"
          )}
        >
          {current ? seasonLabel(current) : "Season"}
          <ChevronDown
            className={cn("h-4 w-4 opacity-60 transition-transform", open && "rotate-180")}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          setOpen(false)
        }}
      >
        <DropdownMenuRadioGroup value={value ?? ""} onValueChange={onChange}>
          {seasons.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              {seasonLabel(s)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
