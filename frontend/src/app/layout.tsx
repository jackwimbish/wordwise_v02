import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/components/providers/AppProvider'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'WordWise - AI Writing Assistant for Publishing Constraints',
  description: 'Meet your page limits without sacrificing quality - AI-powered writing tool designed for strict publishing requirements',
  keywords: ['writing', 'page limits', 'word count', 'publishing constraints', 'AI assistant', 'length management'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
} 