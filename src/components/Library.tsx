import { useEffect, useState } from 'react'
import { EXAMPLE_GUIDE, SEEDED_GUIDE } from '../data/guide'
import { getLibrary, type LibraryEntry } from '../lib/api'
import { formatTime } from '../lib/format'
import { Link } from '../lib/router'
import { ArrowRightIcon, BookIcon, PlayIcon } from './Icons'
import { MobileTabBar } from './MobileTabBar'
import { SiteFooter, SiteHeader } from './SiteHeader'
import { YouTubeMark } from './Marks'

interface CardData {
  id: string
  title: string
  channel: string
  thumbnail: string
  duration: number
  chapterCount: number
  readMinutes: number
  progress: number
  href: string
  label: string
}

export function Library() {
  const [compiled, setCompiled] = useState<CardData[]>([])

  useEffect(() => {
    let active = true
    getLibrary()
      .then((entries) => {
        if (!active) return
        setCompiled(
          entries
            .filter((entry: LibraryEntry) => entry.id !== SEEDED_GUIDE.id && entry.id !== EXAMPLE_GUIDE.id)
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              channel: entry.channel,
              thumbnail: entry.thumbnail,
              duration: entry.duration,
              chapterCount: entry.chapterCount,
              readMinutes: entry.readMinutes,
              progress: entry.progress,
              href: `/read/${entry.id}${entry.firstChapter ? `?chapter=${entry.firstChapter}` : ''}`,
              label: 'Compiled guide',
            })),
        )
      })
      .catch(() => {
        // The seeded guide still works when the local API is offline.
      })
    return () => {
      active = false
    }
  }, [])

  const seeded: CardData = {
    id: EXAMPLE_GUIDE.id,
    title: EXAMPLE_GUIDE.title,
    channel: EXAMPLE_GUIDE.channel,
    thumbnail: EXAMPLE_GUIDE.thumbnail,
    duration: EXAMPLE_GUIDE.duration,
    chapterCount: EXAMPLE_GUIDE.chapterCount,
    readMinutes: EXAMPLE_GUIDE.readMinutes,
    progress: EXAMPLE_GUIDE.progress,
    href: `/read/${EXAMPLE_GUIDE.id}`,
    label: 'Compiled example',
  }

  return (
    <div className="page page--library">
      <SiteHeader />
      <main className="library-main">
        <p className="eyebrow">
          <span className="square-dot" aria-hidden="true" />
          Your library
        </p>
        <div className="library-head">
          <div>
            <h1>Everything you’ve read.</h1>
            <p>Guides you compiled, with your place kept.</p>
          </div>
          <Link to="/" className="button button--dark">
            Paste a video <ArrowRightIcon size={15} />
          </Link>
        </div>

        <GuideCard data={seeded} />
        {compiled.map((entry) => (
          <GuideCard key={entry.id} data={entry} />
        ))}

        <div className="library-empty">
          <BookIcon size={16} />
          <p>
            Every guide you compile lands here. The video stays the source, the notes stay yours.
          </p>
          <span className="library-empty__source">
            <YouTubeMark size={14} /> {compiled.length > 0 ? `${compiled.length} compiled` : 'Ready for a new video'}
          </span>
        </div>
      </main>
      <SiteFooter />
      <MobileTabBar active="library" />
    </div>
  )
}

function GuideCard({ data }: { data: CardData }) {
  return (
    <article className="library-card">
      <div className="library-card__thumb">
        <img src={data.thumbnail} alt="" />
        <span className="library-card__play">
          <PlayIcon size={13} />
        </span>
        <span className="library-card__duration">{formatTime(data.duration)}</span>
      </div>
      <div className="library-card__copy">
        <span className="mono-label">{data.label}</span>
        <h2>{data.title}</h2>
        <p>
          {data.chapterCount} chapters · {data.readMinutes} min read · {data.channel}
        </p>
        <div className="library-card__progress">
          <span style={{ width: `${Math.max(3, data.progress * 100)}%` }} />
        </div>
        <span className="library-card__progress-copy">
          {Math.round(data.progress * 100)}% read
        </span>
      </div>
      <Link to={data.href} className="button button--ghost library-card__open">
        Continue <ArrowRightIcon size={14} />
      </Link>
    </article>
  )
}
