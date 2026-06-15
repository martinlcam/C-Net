import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white hover:bg-neutral-80 active:bg-neutral-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-80 focus-visible:ring-offset-2",
        destructive:
          "bg-black text-white hover:bg-neutral-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-80 focus-visible:ring-offset-2",
        outline:
          "border border-neutral-30 bg-white text-neutral-90 hover:bg-neutral-10 active:bg-neutral-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-80 focus-visible:ring-offset-2",
        secondary:
          "bg-neutral-80 text-white hover:bg-neutral-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-80 focus-visible:ring-offset-2",
        ghost:
          "hover:bg-neutral-10 hover:text-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-40 focus-visible:ring-offset-1",
        link: "text-black underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-40 focus-visible:ring-offset-1",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
