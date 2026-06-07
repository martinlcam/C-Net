import type { ReactNode } from "react"

type Theme = "portfolio" | "bd"

type Props = {
  theme?: Theme
  children: ReactNode
}

/**
 * Left 58px rail + md:border-l shell so the header's vertical rule continues
 * through the hero at scrollY === 0 (header drops its border-r when scrolled).
 */
export function PortfolioHeroFrame({ theme = "portfolio", children }: Props) {
  const border = theme === "bd" ? "border-bd-rule" : "border-black"
  const text = theme === "bd" ? "text-bd-cream font-bd-display" : "text-black"

  return (
    <div className={`border-b ${border} md:border-l`}>
      <div className="flex">
        <div
          className={`hidden md:flex w-[58px] border-r ${border} flex-col items-center shrink-0 ${
            theme === "bd" ? "justify-start py-8" : "pt-2"
          }`}
        >
          {theme === "bd" ? (
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: decorative vertical label div
            <div
              className={`flex flex-col items-center gap-y-5 font-normal ${text} tracking-tight`}
              aria-label="脳波念 — brain, wave, intent"
            >
              <span className="text-[34px] leading-none">脳</span>
              <span className="text-[14px] leading-none text-bd-purple">│</span>
              <span className="text-[34px] leading-none">波</span>
              <span className="text-[14px] leading-none text-bd-purple">│</span>
              <span className="text-[30px] leading-none text-bd-live/85">念</span>
            </div>
          ) : (
            <div
              className={`flex flex-col items-center text-[48px] font-normal ${text} leading-none tracking-tight`}
            >
              <span>C</span>
              <span className="text-[24px]">│</span>
              <span>N</span>
              <span>E</span>
              <span>T</span>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
