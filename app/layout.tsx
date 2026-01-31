import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper'
import { Providers } from './providers'
import { StyleDebugger } from '@/components/StyleDebugger'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Your Name - Portfolio',
  description: 'Full-stack developer portfolio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // #region agent log
  if (typeof window === 'undefined') {
    fetch('http://127.0.0.1:7243/ingest/4f378217-397c-4143-b3cc-29940867ce07', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'layout.tsx:19',
        message: 'RootLayout rendering (server-side)',
        data: { hasGlobalsCss: true, interClassName: inter.className },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {})
  }
  // #endregion

  return (
    <html lang="en">
      <body className={inter.className}>
        <StyleDebugger />
        <SessionProviderWrapper>
          <Providers>{children}</Providers>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
