/*
 * Front-facing (portfolio) pages hide the window scrollbar entirely: content
 * still scrolls, just with no visible track. The rule is rendered with the
 * page rather than added on mount, so the track never flashes before
 * hydration, and it leaves with the layout on the way to the app pages.
 */
export function PortfolioChrome() {
  return (
    <style>{`
      html { scrollbar-width: none; }
      html::-webkit-scrollbar { display: none; }
    `}</style>
  )
}
