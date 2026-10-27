import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'

function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (options.replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useLocation(): string {
  const [location, setLocation] = useState(currentLocation)

  useEffect(() => {
    const onChange = () => setLocation(currentLocation())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  return location
}

export function usePathname(): string {
  const location = useLocation()
  return location.split('?')[0].split('#')[0] || '/'
}

export function useSearchParams(): URLSearchParams {
  const location = useLocation()
  return new URLSearchParams(location.split('?')[1]?.split('#')[0] ?? '')
}

export function setSearchParam(key: string, value: string | null, replace = true): void {
  const url = new URL(window.location.href)
  if (value === null || value === '') url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  navigate(`${url.pathname}${url.search}${url.hash}`, { replace })
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
}

export function Link({ to, onClick, children, ...props }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return
    if (to.startsWith('http') || to.startsWith('mailto:')) return
    event.preventDefault()
    navigate(to)
  }

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
