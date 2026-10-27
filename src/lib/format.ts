export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function parseTime(value: string): number {
  const parts = value.split(':').map((part) => Number(part.trim()))
  if (parts.some((part) => Number.isNaN(part))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] ?? 0
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function percent(value: number): string {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function parseYouTubeUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (YOUTUBE_ID.test(value)) return value

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id && YOUTUBE_ID.test(id) ? id : null
  }

  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null

  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    return id && YOUTUBE_ID.test(id) ? id : null
  }

  const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)
  return match ? match[1] : null
}

export function youtubeEmbedUrl(id: string, startSeconds = 0): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  if (startSeconds > 0) params.set('start', String(Math.floor(startSeconds)))
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

export function youtubeWatchUrl(id: string, startSeconds = 0): string {
  const base = `https://www.youtube.com/watch?v=${id}`
  return startSeconds > 0 ? `${base}&t=${Math.floor(startSeconds)}s` : base
}

export function normalizeQuote(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function findQuote(text: string, quote: string): { before: string; match: string; after: string } | null {
  const needle = normalizeQuote(quote)
  if (!needle) return null
  const haystack = text
  const direct = haystack.indexOf(needle)
  if (direct !== -1) {
    return {
      before: haystack.slice(0, direct),
      match: haystack.slice(direct, direct + needle.length),
      after: haystack.slice(direct + needle.length),
    }
  }
  const lower = haystack.toLowerCase()
  const index = lower.indexOf(needle.toLowerCase())
  if (index === -1) return null
  return {
    before: haystack.slice(0, index),
    match: haystack.slice(index, index + needle.length),
    after: haystack.slice(index + needle.length),
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}
