import { Header } from '@/components/Layout/Header'

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {/* Top border line that spans full width */}
      <div className="fixed top-0 left-0 right-0 h-[1px] bg-neutral-30 z-50" />
      
      <Header />
      {children}
    </div>
  )
}
