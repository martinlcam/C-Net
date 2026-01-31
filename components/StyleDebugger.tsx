'use client'

import { useEffect } from 'react'

export function StyleDebugger() {
  useEffect(() => {
    // #region agent log
    const checkStyles = () => {
      const testElement = document.createElement('div')
      testElement.className = 'text-primary-purple-50 bg-primary-purple-10'
      testElement.style.position = 'absolute'
      testElement.style.left = '-9999px'
      document.body.appendChild(testElement)

      const computed = window.getComputedStyle(testElement)
      const color = computed.color
      const bgColor = computed.backgroundColor
      const tailwindLoaded = color !== 'rgb(0, 0, 0)' || bgColor !== 'rgba(0, 0, 0, 0)'

      // Check if CSS file is loaded
      const stylesheets = Array.from(document.styleSheets)
      const hasTailwind = stylesheets.some((sheet) => {
        try {
          return (
            sheet.href?.includes('_next/static') ||
            Array.from(sheet.cssRules || []).some((rule) => {
              const cssText = rule.cssText || ''
              return cssText.includes('primary-purple') || cssText.includes('.text-primary-purple')
            })
          )
        } catch {
          return false
        }
      })

      document.body.removeChild(testElement)

      fetch('http://127.0.0.1:7243/ingest/4f378217-397c-4143-b3cc-29940867ce07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'StyleDebugger.tsx:checkStyles',
          message: 'Style check results',
          data: {
            tailwindLoaded,
            testColor: color,
            testBgColor: bgColor,
            stylesheetCount: stylesheets.length,
            hasTailwind,
            customColorsWork: color.includes('124') || bgColor.includes('250'), // purple RGB values
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
        }),
      }).catch(() => {})

      // Also check computed styles on actual page elements
      const hero = document.querySelector('[class*="primary-purple-80"]')
      if (hero) {
        const heroStyle = window.getComputedStyle(hero)
        fetch('http://127.0.0.1:7243/ingest/4f378217-397c-4143-b3cc-29940867ce07', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'StyleDebugger.tsx:checkHero',
            message: 'Hero element computed styles',
            data: {
              heroColor: heroStyle.color,
              heroFontSize: heroStyle.fontSize,
              heroFontWeight: heroStyle.fontWeight,
              className: hero.className,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {})
      }
    }

    // Run check after a short delay to allow styles to load
    setTimeout(checkStyles, 100)
    setTimeout(checkStyles, 1000) // Check again after 1s
    // #endregion
  }, [])

  return null
}