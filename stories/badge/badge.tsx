import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-purple-40 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-purple-50 text-white hover:bg-primary-purple-55",
        secondary: "border-transparent bg-secondary-blue-60 text-white hover:bg-secondary-blue-70",
        destructive: "border-transparent bg-accent-red-60 text-white hover:bg-accent-red-70",
        success: "border-transparent bg-accent-green-60 text-white hover:bg-accent-green-70",
        outline: "text-neutral-100 border-neutral-40",
        warning: "border-transparent bg-yellow-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
