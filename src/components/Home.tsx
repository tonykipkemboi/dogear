import { useRef, useState, type FormEvent } from 'react'
import { CompileDialog } from './CompileDialog'
import { MobileTabBar } from './MobileTabBar'
import { SiteFooter, SiteHeader } from './SiteHeader'
import { ArrowRightIcon } from './Icons'
import { YouTubeMark } from './Marks'
import { Link, navigate } from '../lib/router'
import { formatTime, parseYouTubeUrl } from '../lib/format'
import { EXAMPLE_GUIDE } from '../data/guide'

const DEMO_ID = EXAMPLE_GUIDE.youtubeId

export function Home() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [compileUrl, setCompileUrl] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const openDemo = () => {
    navigate(`/read/${EXAMPLE_GUIDE.id}`)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const id = parseYouTubeUrl(value)
    if (!id) {
      setError('Paste a YouTube link to start. Short links and watch links both work.')
      return
    }
    setError(null)
    if (id === DEMO_ID) {
      openDemo()
      return
    }
    setCompileUrl(`https://www.youtube.com/watch?v=${id}`)
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setError('Local file ingest is the next hook. For now, paste a YouTube link or open the demo.')
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="page page--home">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="home-main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__inner">
            <p className="eyebrow hero__eyebrow">
              <span className="square-dot" aria-hidden="true" />
              The video textbook
            </p>
            <h1 id="hero-title" className="hero__title">
              Paste a video.
              <br />
              <span className="hero__mark">Learn</span> from it.
            </h1>
            <p className="hero__lede">A chaptered guide you can read at your level, search, and question.</p>
            <form className="url-form" onSubmit={handleSubmit} noValidate>
              <div className={`url-form__field ${error ? 'has-error' : ''}`}>
                <YouTubeMark size={30} className="url-form__youtube" />
                <label htmlFor="video-url" className="sr-only">
                  YouTube video link
                </label>
                <input
                  id="video-url"
                  name="video-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="youtube.com/watch?v=…"
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value)
                    if (error) setError(null)
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'url-error' : 'url-help'}
                />
                <button type="submit" className="url-form__submit">
                  Compile <ArrowRightIcon size={16} />
                </button>
              </div>
              <div className="url-form__note">
                <span id="url-help">
                  Paste a YouTube link, a playlist, or{' '}
                  <button type="button" className="inline-link" onClick={() => fileInput.current?.click()}>
                    upload a file
                  </button>
                  .
                </span>
                <span className="url-form__open-source">
                  Open source · <Link to="/settings">bring your key</Link>
                </span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="video/*,audio/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              {error ? (
                <p id="url-error" className="url-form__error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
            <div className="or-try">
              <span>or try</span>
              <button type="button" className="or-try__button" onClick={openDemo}>
                <span className="or-try__thumb">
                  <img src={EXAMPLE_GUIDE.thumbnail} alt="" />
                  <YouTubeMark size={18} />
                </span>
                <span className="or-try__title">{EXAMPLE_GUIDE.title}</span>
                <span className="or-try__time">{formatTime(EXAMPLE_GUIDE.duration)}</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="how" id="how" aria-labelledby="how-title">
          <div className="how__inner">
            <div className="how__intro">
              <p className="eyebrow">
                <span className="square-dot" aria-hidden="true" />
                How it works
              </p>
              <h2 id="how-title">Three steps.</h2>
              <p>The page comes first. The highlighter does the rest.</p>
            </div>
            <div className="how__steps">
              <article className="step">
                <span className="step__number">01</span>
                <h3>Paste or upload.</h3>
                <p>YouTube, a lecture, a Loom, or a file on your laptop.</p>
              </article>
              <article className="step">
                <span className="step__number">02</span>
                <h3>Pick a level.</h3>
                <p>ELI5 to PhD. Change it later and the highlights follow.</p>
              </article>
              <article className="step">
                <span className="step__number">03</span>
                <h3>Pull the threads.</h3>
                <p>Highlight anything. The highlighter explains it, or checks the docs.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="how-mobile" aria-labelledby="how-mobile-title">
          <div className="how-mobile__head">
            <span className="square-dot" aria-hidden="true" />
            <h2 id="how-mobile-title">How it works</h2>
          </div>
          <div className="how-mobile__row">
            <span>01</span>
            <div>
              <strong>Paste a link.</strong>
              <p>YouTube, a lecture, or a file.</p>
            </div>
          </div>
          <div className="how-mobile__row">
            <span>02</span>
            <div>
              <strong>Pick a level.</strong>
              <p>ELI5 to PhD. Change it later.</p>
            </div>
          </div>
          <div className="how-mobile__row">
            <span>03</span>
            <div>
              <strong>Read and ask.</strong>
              <p>Highlight anything. The options appear above it.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <MobileTabBar active="paste" />
      <CompileDialog
        url={compileUrl}
        onClose={() => setCompileUrl(null)}
        onReady={(guideId) => {
          setCompileUrl(null)
          navigate(`/read/${guideId}`)
        }}
        onDemo={() => {
          setCompileUrl(null)
          openDemo()
        }}
      />
    </div>
  )
}
