/** BD route shell — dark ground so portfolio layout's cream/white never bleeds through. */
export default function BdLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bd-bg text-bd-cream">{children}</div>
}
