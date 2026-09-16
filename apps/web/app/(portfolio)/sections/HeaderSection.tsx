"use client"

import { Audiowide } from "next/font/google"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import { useAuthModal } from "@/lib/stores/auth-modal"
import { useDevicePixel } from "@/lib/use-device-pixel"
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
 * The left side of the section row in a 400x106 box: a photo parallelogram
 * made of the cat sticker blown up and blurred to fill the field, the 45° tip
 * of the news bar overlapping its top-right, both closed by hairlines along
 * their slants, and the hairline art that hangs off the bar's corner over it. The white strip to the right of the photo, under the news bar, carries
 * the tech ticker. The line art and the tip take their colors from the
 * stylesheet; the photo is an image and keeps its own.
 */
function SectionArt() {
  const id = useId()
  const clipId = `${id}-photo`
  const blurId = `${id}-blur`

  return (
    <svg className={styles.art} viewBox="0 0 400 106" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <polygon points="0,20 352,20 273,103 0,103" />
        </clipPath>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* the sticker is square with the cat in its middle: enlarged until the
            cat's body covers the whole field, mirrored so it faces the bar, and
            blurred into a backdrop */}
        <image
          href="/images/masthead-cat.webp"
          x="-171"
          y="-286"
          width="680"
          height="680"
          transform="translate(338 0) scale(-1 1)"
          filter={`url(#${blurId})`}
        />
      </g>
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
      {/* the photo's slanted right edge is closed by its own hairline */}
      <line className={styles.artSlant} x1="352" y1="20" x2="273" y2="103" />
      {/* one 45° hairline runs from the bar's corner down its tip's slant and on
          to the loop's flat part, so the tip's edge and the loop share a line */}
      <polygon className={styles.artTip} points="241,1 241,45 197,45" />
      <line className={styles.artSlant} x1="241" y1="1" x2="178.5" y2="63.5" />
      <line
        className={styles.artLine}
        x1="178.5"
        y1="63.5"
        x2="0"
        y2="63.5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        className={styles.artLine}
        x1="0"
        y1="45.5"
        x2="195"
        y2="45.5"
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
  const root = useRef<HTMLElement>(null)
  useDevicePixel(root, "--gc-dp")

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
    <header ref={root} className={`${styles.header} ${logoFallbackFont.variable}`}>
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
