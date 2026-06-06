"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/stories/button/button"

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Sign out
    </Button>
  )
}
