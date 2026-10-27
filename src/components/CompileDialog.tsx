import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'
import { ArrowRightIcon, CloseIcon } from './Icons'
import { YouTubeMark } from './Marks'
import { Link } from '../lib/router'
import { parseYouTubeUrl } from '../lib/format'
import { LEVELS, type Level } from '../data/guide'
import { readLevel, readPrefs } from '../lib/storage'

interface CompileResponse {
  guideId?: string
  guide?: { id: string }
  error?: string
}

const STAGES = ['Fetching the transcript', 'Mapping the argument', 'Writing the guide']

const PURPOSES = [
  { id: 'understand', label: 'Understand the concept', lead: 'Build a clear mental model, with examples and the ideas that connect.' },
  { id: 'interview', label: 'Prepare for an interview', lead: 'Focus on the claims, tradeoffs, and questions worth being ready for.' },
  { id: 'build', label: 'Build something with it', lead: 'Turn the material into practical decisions, steps, and pitfalls.' },
  { id: 'overview', label: 'Get a quick overview', lead: 'Keep the spine of the argument and leave out the detours.' },
]

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
  const [started, setStarted] = useState(false)
  const [level, setLevel] = useState<Level>(() => readLevel())
  const [purpose, setPurpose] = useState('understand')
  const [progress, setProgress] = useState(6)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!url) return
    setStarted(false)
    setLevel(readLevel())
    setPurpose('understand')
    setProgress(6)
    setStage(0)
    setError(null)
    setRunning(false)
  }, [url])

  useEffect(() => {
    if (!url || !started) return undefined
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
      body: JSON.stringify({
        url,
        level,
        purpose,
        model: readPrefs().model,
      }),
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
  }, [url, started, level, purpose, onReady])

  const videoId = url ? parseYouTubeUrl(url) : null
  const purposeInfo = PURPOSES.find((item) => item.id === purpose) ?? PURPOSES[0]

  const retry = () => {
    setStarted(false)
    setError(null)
    setProgress(6)
    setStage(0)
  }

  return (
    <Dialog open={Boolean(url)} onClose={onClose} className="compile-dialog" labelledBy="compile-title">
      <div className="compile-dialog__head">
        <div className="compile-dialog__eyebrow">
          <span className="square-dot" aria-hidden="true" />
          {started ? 'Compiling' : 'New guide'}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close compiler">
          <CloseIcon size={17} />
        </button>
      </div>

      {!started && !error ? (
        <form
          className="compile-setup"
          onSubmit={(event) => {
            event.preventDefault()
            setStarted(true)
          }}
        >
          <h2 id="compile-title" className="compile-dialog__title">
            How should we write it?
          </h2>
          <p className="compile-dialog__lede">
            Pick the depth and the reason you are watching. The guide will be written for that,
            not just transcribed.
          </p>

          {videoId ? <CompileVideo id={videoId} /> : null}

          <div className="compile-options">
            <label className="compile-option" htmlFor="compile-level">
              <span>Reading level</span>
              <select
                id="compile-level"
                value={level}
                onChange={(event) => setLevel(event.target.value as Level)}
              >
                {LEVELS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} · {item.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="compile-option" htmlFor="compile-purpose">
              <span>What are you here for?</span>
              <select
                id="compile-purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                {PURPOSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="compile-purpose-note">{purposeInfo.lead}</p>

          <div className="compile-setup-foot">
            <span className="compile-setup-note">Written by your Nebius model. The video stays the source.</span>
            <button type="submit" className="button button--dark compile-start">
              Compile guide <ArrowRightIcon size={15} />
            </button>
          </div>
        </form>
      ) : (
        <>
          <h2 id="compile-title" className="compile-dialog__title">
            {error ? 'The compiler stopped.' : 'Making the page.'}
          </h2>
          <p className="compile-dialog__lede">
            {error
              ? error
              : `Writing a ${level} guide for ${purposeInfo.label.toLowerCase()}. The video stays the source.`}
          </p>

          {videoId ? <CompileVideo id={videoId} /> : null}

          <div className="compile-progress" aria-live="polite">
            <div className="compile-progress__bar">
              <span style={{ width: `${error ? 100 : progress}%` }} />
            </div>
            <div className="compile-progress__meta">
              <span>{error ? 'Stopped' : STAGES[stage]}</span>
              <span>{error ? 'Stopped' : `${Math.round(progress)}%`}</span>
            </div>
          </div>

          {error ? (
            <div className="compile-dialog__actions compile-dialog__error-actions">
              <button type="button" className="button button--small button--ghost" onClick={retry}>
                Adjust and retry
              </button>
              {error.toLowerCase().includes('key') || error.toLowerCase().includes('nebius') ? (
                <Link to="/settings" className="button button--small button--dark">
                  Open keys <ArrowRightIcon size={13} />
                </Link>
              ) : null}
              <button type="button" className="button button--small button--dark" onClick={onDemo}>
                Try the demo instead
              </button>
            </div>
          ) : (
            <div className="compile-dialog__foot">
              <span className="mono-label">{running ? 'Grounded in the transcript' : 'Finishing'}</span>
              <span className="compile-dialog__foot-dot" aria-hidden="true" />
              <span className="mono-label">Nebius Token Factory</span>
            </div>
          )}
        </>
      )}
    </Dialog>
  )
}

function CompileVideo({ id }: { id: string }) {
  return (
    <div className="compile-dialog__video">
      <span className="compile-dialog__thumb">
        <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" />
        <YouTubeMark size={20} />
      </span>
      <div>
        <span className="compile-dialog__video-label">YouTube video</span>
        <span className="compile-dialog__video-id">{id}</span>
      </div>
    </div>
  )
}
