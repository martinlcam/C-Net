import { PortfolioChrome } from "./PortfolioChrome"

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <PortfolioChrome />
      {children}
    </div>
  )
}
