"use client"

import { Audiowide } from "next/font/google"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { type FormEvent, useEffect, useId, useState } from "react"
import { useAuthModal } from "@/lib/stores/auth-modal"
import { TechTicker } from "../components/TechTicker"
import styles from "./HeaderSection.module.css"

// Fallback wordmark face, used until the Flying Landing files are present in public/fonts.
const logoFallbackFont = Audiowide({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-gc-logo-fallback",
})

const SITE_HOST = "martin.cam"

const navItems = [
  { title: "Home", href: "/" },
  { title: "About", href: "/#about" },
  { title: "Projects", href: "/#projects" },
  { title: "Contact", href: "/#contact" },
  { title: "BFIDA", href: "/bfida" },
  { title: "BD", href: "/bd" },
]

/*
 * The left side of the section row in a 400x106 box: a flat orange photo
 * parallelogram, the 45° tip of the news bar overlapping its top-right, and
 * the black line art that hangs off the bar's corner. The white strip to the
 * right of the photo, under the news bar, carries the tech ticker. The colors
 * come from the stylesheet so the whole masthead's palette lives in one place.
 */
function SectionArt() {
  const id = useId()
  const clipId = `${id}-photo`

  return (
    <svg className={styles.art} viewBox="0 0 400 106" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <polygon points="0,20 352,20 273,103 0,103" />
        </clipPath>
      </defs>
      <rect
        className={styles.artPhoto}
        clipPath={`url(#${clipId})`}
        x="0"
        y="20"
        width="352"
        height="83"
      />
      <line
        className={styles.artLine}
        x1="0"
        y1="20.5"
        x2="352"
        y2="20.5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        className={styles.artLine}
        x1="0"
        y1="102.5"
        x2="273"
        y2="102.5"
        vectorEffect="non-scaling-stroke"
      />
      <polygon className={styles.artTip} points="241,1 241,45 195,45" />
      <polyline
        className={styles.artLine}
        points="220,20 178,63 0,63"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <line
        className={styles.artLine}
        x1="0"
        y1="46"
        x2="195"
        y2="46"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function HeaderSection() {
  const { data: session, status } = useSession()
  const { openModal } = useAuthModal()
  const pathname = usePathname()
  const [host, setHost] = useState(SITE_HOST)
  const [query, setQuery] = useState("")

  useEffect(() => {
    setHost(window.location.host)
  }, [])

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href)

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const term = query.trim()
    if (!term) return
    const url = new URL("https://duckduckgo.com/")
    url.searchParams.set("q", term)
    url.searchParams.set("sites", host)
    window.location.assign(url.toString())
  }

  const location = pathname === "/" ? host : `${host}${pathname}`

  return (
    <header className={`${styles.header} ${logoFallbackFont.variable}`}>
      <div className={styles.top}>
        <Link href="/" className={styles.logo} aria-label="martin.cam home">
          <span className={styles.wordmark} aria-hidden="true">
            martin.cam
          </span>
        </Link>

        <div className={styles.band}>
          <div className={styles.bandInner}>
            <search>
              <form className={styles.searchForm} onSubmit={handleSearch}>
                <label htmlFor="site-search" className={styles.searchLabel}>
                  search:
                </label>
                <input
                  id="site-search"
                  name="q"
                  type="search"
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
              </form>
            </search>
            {status === "loading" ? (
              <span className={styles.bracket} aria-hidden="true">
                [--]
              </span>
            ) : session ? (
              <Link href="/cnet/dashboard" className={styles.bracket} title="C-Net dashboard">
                [--]
              </Link>
            ) : (
              <button type="button" className={styles.bracket} title="Sign in" onClick={openModal}>
                [--]
              </button>
            )}
          </div>
        </div>

        <nav aria-label="Primary" className={styles.nav}>
          <ul className={styles.tabs}>
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <li key={item.href} className={styles.tab}>
                  <Link
                    href={item.href}
                    className={styles.tabLink}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className={styles.section}>
        <SectionArt />
        <div className={styles.bar}>
          <span className={styles.barText}>{location}</span>
        </div>
        <div className={styles.underline} aria-hidden="true" />
        <div className={styles.rule} aria-hidden="true" />
        <div className={styles.ticker}>
          <TechTicker />
        </div>
      </div>
    </header>
  )
}
