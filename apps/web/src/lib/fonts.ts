import localFont from 'next/font/local'

export const bevellier = localFont({
  src: '../app/fonts/Bevellier-Variable.woff2',
  display: 'swap',
  style: 'normal',
  variable: '--font-bevellier',
  weight: '100 900',
})

export const supreme = localFont({
  src: '../app/fonts/Supreme-Variable.woff2',
  display: 'swap',
  style: 'normal',
  variable: '--font-supreme',
  weight: '100 800',
})
