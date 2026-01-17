import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper'
import { Providers } from './providers'
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
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProviderWrapper>
          <Providers>{children}</Providers>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
