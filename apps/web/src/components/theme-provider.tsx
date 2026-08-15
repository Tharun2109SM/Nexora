'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  theme: Theme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const storageKey = 'nexora-theme'
const changeEvent = 'nexora-theme-change'
const subscribeToHydration = () => () => undefined

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getThemeSnapshot(): Theme {
  const saved = window.localStorage.getItem(storageKey)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onStoreChange)
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(changeEvent, onStoreChange)
  return () => {
    media.removeEventListener('change', onStoreChange)
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(changeEvent, onStoreChange)
  }
}

function getServerThemeSnapshot(): Theme {
  return 'system'
}

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = useSyncExternalStore<Theme>(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  )
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )
  const resolvedTheme = isHydrated ? resolveTheme(theme) : 'light'

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(storageKey, nextTheme)
    window.dispatchEvent(new Event(changeEvent))
  }, [])

  const value = useMemo(
    () => ({ resolvedTheme, setTheme, theme }),
    [resolvedTheme, setTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
