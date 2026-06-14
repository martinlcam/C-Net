"use client"

import { useId, useState } from "react"
import { Button } from "@/stories/button/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/stories/dialog/dialog"

export type TextPrompt = { title: string; initial: string; onSubmit: (value: string) => void }

export function TextDialog({
  prompt,
  onClose,
}: {
  prompt: TextPrompt | null
  onClose: () => void
}) {
  const [value, setValue] = useState("")
  const inputId = useId()

  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (open && prompt) setValue(prompt.initial)
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt?.title}</DialogTitle>
        </DialogHeader>
        <input
          id={inputId}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && prompt) {
              prompt.onSubmit(value)
              onClose()
            }
          }}
          className="w-full rounded-md border border-neutral-30 px-3 py-2 text-sm outline-none focus:border-neutral-80"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (prompt) prompt.onSubmit(value)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
