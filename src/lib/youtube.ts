export interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  getPlayerState: () => number
  setPlaybackRate: (rate: number) => void
  getPlaybackRate: () => number
  loadModule?: (module: string) => void
  unloadModule?: (module: string) => void
  setOption?: (module: string, option: string, value: unknown) => void
  destroy: () => void
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeApi> | null = null

export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser window.'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  const promise = new Promise<YouTubeApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    )
    const timeout = window.setTimeout(() => reject(new Error('YouTube player timed out.')), 15_000)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) {
        window.clearTimeout(timeout)
        resolve(window.YT)
      }
    }
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }
  }).catch((error) => {
    apiPromise = null
    throw error
  })

  apiPromise = promise
  return promise
}

export function setYouTubeCaptions(player: YouTubePlayer, enabled: boolean): void {
  try {
    if (enabled) {
      player.loadModule?.('captions')
      player.setOption?.('captions', 'track', { languageCode: 'en' })
    } else {
      player.unloadModule?.('captions')
    }
  } catch {
    // Some videos have no caption track. The button still reflects intent.
  }
}
