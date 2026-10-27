import { useEffect } from 'react'
import { Home } from './components/Home'
import { Keys } from './components/Keys'
import { Library } from './components/Library'
import { NotFound } from './components/NotFound'
import { Reader } from './components/Reader'
import { ToastProvider } from './components/Toast'
import { useLocation, usePathname } from './lib/router'

const TITLES: Record<string, string> = {
  '/': 'Dogear | Paste a video. Learn from it.',
  '/library': 'Library | Dogear',
  '/settings': 'Keys | Dogear',
  '/keys': 'Keys | Dogear',
}

export default function App() {
  const pathname = usePathname()
  const location = useLocation()
  const hash = location.split('#')[1]

  useEffect(() => {
    document.title = pathname.startsWith('/read/')
      ? 'Read | Dogear'
      : TITLES[pathname] ?? 'Dogear'
  }, [pathname])

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      return undefined
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname, hash])

  let content
  if (pathname === '/') content = <Home />
  else if (pathname.startsWith('/read/')) content = <Reader key={pathname} />
  else if (pathname === '/settings' || pathname === '/keys') content = <Keys />
  else if (pathname === '/library') content = <Library />
  else content = <NotFound />

  return <ToastProvider>{content}</ToastProvider>
}
