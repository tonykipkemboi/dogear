import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'
import { ArrowRightIcon, CloseIcon } from './Icons'
import { YouTubeMark } from './Marks'
import { Link } from '../lib/router'
import { parseYouTubeUrl } from '../lib/format'

interface CompileResponse {
  guideId?: string
  guide?: { id: string }
  error?: string
}

const STAGES = ['Fetching the transcript', 'Finding the chapters', 'Writing the guide']

export function CompileDialog({
  url,
  onClose,
  onReady,
  onDemo,
}: {
  url: string | null
  onClose: () => void
  onReady: (guideId: string) => void
  onDemo: () => void
}) {
  const [progress, setProgress] = useState(6)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!url) return undefined
    setProgress(8)
    setStage(0)
    setError(null)
    setRunning(true)
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) return current
        const next = current + (current < 35 ? 7 : current < 65 ? 4 : 1)
        setStage(next > 64 ? 2 : next > 32 ? 1 : 0)
        return next
      })
    }, 650)

    const controller = new AbortController()
    fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as CompileResponse
        if (!response.ok) throw new Error(data.error || 'The compiler could not finish this video.')
        const guideId = data.guideId ?? data.guide?.id
        if (!guideId) throw new Error('The compiler returned no guide.')
        setProgress(100)
        setStage(2)
        window.setTimeout(() => onReady(guideId), 450)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'The compiler could not finish this video.')
      })
      .finally(() => {
        window.clearInterval(interval)
        setRunning(false)
      })

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [url, onReady])

  const videoId = url ? parseYouTubeUrl(url) : null

  return (
    <Dialog open={Boolean(url)} onClose={onClose} className="compile-dialog" labelledBy="compile-title">
      <div className="compile-dialog__head">
        <div className="compile-dialog__eyebrow">
          <span className="square-dot" aria-hidden="true" />
          Compiling
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close compiler">
          <CloseIcon size={17} />
        </button>
      </div>
      <h2 id="compile-title" className="compile-dialog__title">
        Making the page.
      </h2>
      <p className="compile-dialog__lede">
        We read the transcript, find the seams, and turn it into a page. The video stays the source.
      </p>
      {videoId ? (
        <div className="compile-dialog__video">
          <span className="compile-dialog__thumb">
            <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} alt="" />
            <YouTubeMark size={20} />
          </span>
          <div>
            <span className="compile-dialog__video-label">YouTube video</span>
            <span className="compile-dialog__video-id">{videoId}</span>
          </div>
        </div>
      ) : null}
      <div className="compile-progress" aria-live="polite">
        <div className="compile-progress__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="compile-progress__meta">
          <span>{error ? 'Stopped' : STAGES[stage]}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
      {error ? (
        <div className="compile-dialog__error" role="alert">
          <strong>{error.toLowerCase().includes('key') ? 'That one needs a key.' : 'The compiler stopped.'}</strong>
          <p>{error}</p>
          <div className="compile-dialog__actions">
            <Link to="/settings" className="button button--small button--dark">
              Open keys <ArrowRightIcon size={13} />
            </Link>
            <button type="button" className="button button--small button--ghost" onClick={onDemo}>
              Try the demo instead
            </button>
          </div>
        </div>
      ) : (
        <div className="compile-dialog__foot">
          <span className="mono-label">{running ? 'Grounded in the transcript' : 'Finishing'}</span>
          <span className="compile-dialog__foot-dot" aria-hidden="true" />
          <span className="mono-label">Nebius Token Factory</span>
        </div>
      )}
    </Dialog>
  )
}
