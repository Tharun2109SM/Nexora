import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

import { ThemeProvider } from '@/components/theme-provider'
import { bevellier, supreme } from '@/lib/fonts'

import './globals.css'

const themeInitializationScript = `
  (function () {
    try {
      var saved = localStorage.getItem('nexora-theme');
      var theme = saved === 'light' || saved === 'dark'
        ? saved
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`

export const metadata: Metadata = {
  title: {
    default: 'NEXORA | Product Operations & Customer Success',
    template: '%s | NEXORA',
  },
  description:
    'A shared product operations and customer success workspace from Beau Roi Technologies.',
  applicationName: 'NEXORA',
  robots: { follow: true, index: true },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${bevellier.variable} ${supreme.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <Script id="nexora-theme-init" strategy="beforeInteractive">
          {themeInitializationScript}
        </Script>
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
