"use client"

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import * as React from "react"
import { cn } from "@/lib/utils"

const dropdownContentMotion =
  "will-change-[opacity,transform] data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade"

const dropdownContentShell =
  "z-50 overflow-visible border-0 bg-transparent p-0 shadow-none outline-none"

const ARROW_W = 12
const ARROW_H = 6

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

type NotchFlank = { before: number; after: number; side: "top" | "bottom" | "left" | "right" }

function measureNotch(panel: HTMLElement, arrow: SVGSVGElement): NotchFlank {
  const side = (panel.parentElement?.getAttribute("data-side") ?? "bottom") as NotchFlank["side"]
  const panelRect = panel.getBoundingClientRect()
  const arrowRect = arrow.getBoundingClientRect()

  if (side === "top") {
    return {
      side,
      before: Math.max(0, arrowRect.left - panelRect.left),
      after: Math.max(0, panelRect.right - arrowRect.right),
    }
  }
  if (side === "left") {
    return {
      side,
      before: Math.max(0, arrowRect.top - panelRect.top),
      after: Math.max(0, panelRect.bottom - arrowRect.bottom),
    }
  }
  if (side === "right") {
    return {
      side,
      before: Math.max(0, arrowRect.top - panelRect.top),
      after: Math.max(0, panelRect.bottom - arrowRect.bottom),
    }
  }
  // bottom — arrow sits on the panel's top edge
  return {
    side: "bottom",
    before: Math.max(0, arrowRect.left - panelRect.left),
    after: Math.max(0, panelRect.right - arrowRect.right),
  }
}

function NotchFlankLines({ flank }: { flank: NotchFlank | null }) {
  if (!flank) return null
  const line = "absolute bg-neutral-30"

  if (flank.side === "bottom") {
    return (
      <>
        <div className={cn(line, "top-0 left-0 h-px")} style={{ width: flank.before }} />
        <div className={cn(line, "top-0 right-0 h-px")} style={{ width: flank.after }} />
      </>
    )
  }
  if (flank.side === "top") {
    return (
      <>
        <div className={cn(line, "bottom-0 left-0 h-px")} style={{ width: flank.before }} />
        <div className={cn(line, "bottom-0 right-0 h-px")} style={{ width: flank.after }} />
      </>
    )
  }
  if (flank.side === "left") {
    return (
      <>
        <div className={cn(line, "top-0 left-0 w-px")} style={{ height: flank.before }} />
        <div className={cn(line, "bottom-0 left-0 w-px")} style={{ height: flank.after }} />
      </>
    )
  }
  return (
    <>
      <div className={cn(line, "top-0 right-0 w-px")} style={{ height: flank.before }} />
      <div className={cn(line, "bottom-0 right-0 w-px")} style={{ height: flank.after }} />
    </>
  )
}

function panelEdgeClasses(side: NotchFlank["side"]) {
  switch (side) {
    case "top":
      return "rounded-t-md border border-neutral-30 border-b-0"
    case "left":
      return "rounded-l-md border border-neutral-30 border-r-0"
    case "right":
      return "rounded-r-md border border-neutral-30 border-l-0"
    default:
      return "rounded-b-md border border-neutral-30 border-t-0"
  }
}

/** Panel + arrow: border stops at the notch and continues around the arrow via flank lines + arrow stroke. */
function DropdownMenuChrome({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const arrowRef = React.useRef<SVGSVGElement>(null)
  const [flank, setFlank] = React.useState<NotchFlank | null>(null)

  const syncNotch = React.useCallback(() => {
    const panel = panelRef.current
    const arrow = arrowRef.current
    if (!panel || !arrow) return
    setFlank(measureNotch(panel, arrow))
  }, [])

  React.useLayoutEffect(() => {
    const run = () => syncNotch()
    run()
    const raf = requestAnimationFrame(run)
    const panel = panelRef.current
    if (!panel) return () => cancelAnimationFrame(raf)
    const observer = new ResizeObserver(run)
    observer.observe(panel)
    window.addEventListener("resize", run)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener("resize", run)
    }
  }, [syncNotch])

  const side = flank?.side ?? "bottom"

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          "relative min-w-[8rem] w-full bg-white p-1 text-neutral-100",
          "shadow-[0px_10px_38px_-10px_rgba(22,23,24,0.35),0px_10px_20px_-15px_rgba(22,23,24,0.2)]",
          panelEdgeClasses(side),
          className
        )}
      >
        <NotchFlankLines flank={flank} />
        {children}
      </div>
      <DropdownMenuPrimitive.Arrow
        ref={arrowRef}
        width={ARROW_W}
        height={ARROW_H}
        className="relative z-10 fill-white stroke-neutral-30 stroke-[1px] [stroke-linejoin:round]"
      />
    </>
  )
}

const DropdownMenuArrow = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Arrow>
>((props, ref) => (
  <DropdownMenuPrimitive.Arrow
    ref={ref}
    width={ARROW_W}
    height={ARROW_H}
    className={cn(
      "relative z-10 fill-white stroke-neutral-30 stroke-[1px] [stroke-linejoin:round]",
      props.className
    )}
    {...props}
  />
))
DropdownMenuArrow.displayName = DropdownMenuPrimitive.Arrow.displayName

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-primary-purple-10 data-[state=open]:bg-primary-purple-10",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, children, sideOffset = 2, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      sideOffset={sideOffset}
      className={cn(dropdownContentShell, dropdownContentMotion, className)}
      {...props}
    >
      <DropdownMenuChrome>{children}</DropdownMenuChrome>
    </DropdownMenuPrimitive.SubContent>
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 5, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(dropdownContentShell, dropdownContentMotion, className)}
      {...props}
    >
      <DropdownMenuChrome>{children}</DropdownMenuChrome>
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-primary-purple-10 focus:text-primary-purple-60 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-primary-purple-10 focus:text-primary-purple-60 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-primary-purple-10 focus:text-primary-purple-60 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <div className="h-2 w-2 rounded-full bg-primary-purple-50" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-neutral-30", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuArrow,
}
