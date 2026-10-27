import { useRef, type SyntheticEvent } from 'react'
import type { Block, Chapter, Guide } from '../data/guide'
import { PlayIcon } from './Icons'
import { YouTubeMark } from './Marks'
import { findQuote, formatTime, normalizeQuote } from '../lib/format'

export interface SelectionAnchor {
  top: number
  left: number
  width: number
  bottom: number
}

export function Article({
  guide,
  chapter,
  activeQuote,
  onSelectText,
  onPlay,
}: {
  guide: Guide
  chapter: Chapter
  activeQuote: string | null
  onSelectText: (text: string, anchor: SelectionAnchor) => void
  onPlay: (seconds: number) => void
}) {
  const articleRef = useRef<HTMLElement>(null)
  const frameCount = chapter.blocks.filter((block) => block.type === 'frame').length

  const capture = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const root = articleRef.current
    if (!root || !root.contains(range.commonAncestorContainer)) return
    const node =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement
    if (!node || node.closest('button, a, input, textarea, select')) return
    const text = normalizeQuote(selection.toString())
    if (text.length < 3 || text.length > 280) return
    const rect = range.getBoundingClientRect()
    if (rect.width < 2 && rect.height < 2) return
    onSelectText(text, { top: rect.top, left: rect.left, width: rect.width, bottom: rect.bottom })
  }

  const handleMouseUp = () => {
    window.setTimeout(capture, 0)
  }

  const handleTouchEnd = () => {
    window.setTimeout(capture, 40)
  }

  const handleKeyUp = (event: SyntheticEvent<HTMLElement, KeyboardEvent>) => {
    if (event.nativeEvent.shiftKey || event.nativeEvent.key === 'Shift') window.setTimeout(capture, 0)
  }

  return (
    <article
      className="article"
      id="article"
      ref={articleRef}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      onKeyUp={handleKeyUp}
      tabIndex={-1}
    >
      <header className="article__head">
        <div className="article__meta">
          <span>
            Chapter {String(chapter.number).padStart(2, '0')} · {formatTime(chapter.start)}
          </span>
          <span className="in-video-pill">
            <span className="square-dot" aria-hidden="true" /> In the video
          </span>
          <button type="button" className="article__play-section" onClick={() => onPlay(chapter.start)}>
            <PlayIcon size={8} /> Play section
          </button>
        </div>
        <h1 className="article__title">{chapter.title}</h1>
        <p className="article__deck">{chapter.deck}</p>
        <div className="article__details">
          <span>{chapter.readMinutes} min read</span>
          {frameCount > 0 ? (
            <>
              <span className="meta-dot" aria-hidden="true" />
              <span>
                {frameCount} video {frameCount === 1 ? 'frame' : 'frames'}
              </span>
            </>
          ) : null}
          <span className="meta-dot" aria-hidden="true" />
          <span>
            {guide.webSourceCount} web {guide.webSourceCount === 1 ? 'source' : 'sources'}
          </span>
        </div>
      </header>

      <div className="article__body">
        {chapter.blocks.map((block, index) => (
          <BlockView
            key={`${chapter.id}-${index}`}
            block={block}
            activeQuote={activeQuote}
            onPlay={onPlay}
          />
        ))}
      </div>
    </article>
  )
}

function BlockView({
  block,
  activeQuote,
  onPlay,
}: {
  block: Block
  activeQuote: string | null
  onPlay: (seconds: number) => void
}) {
  if (block.type === 'p') {
    return (
      <div className="article__paragraph-wrap">
        <p className="article__paragraph">
          {activeQuote ? renderHighlighted(block.text, activeQuote) : block.text}
        </p>
        {block.timestamp ? (
          <button
            type="button"
            className="timestamp-chip"
            onClick={() => onPlay(block.timestamp!.seconds)}
          >
            <PlayIcon size={7} /> {formatTime(block.timestamp.seconds)} · {block.timestamp.label}
          </button>
        ) : null}
      </div>
    )
  }

  if (block.type === 'h2') {
    return (
      <div className="article__section-head">
        {block.kicker ? <span className="article__kicker">{block.kicker}</span> : null}
        <div className="article__h2-row">
          <h2>{block.text}</h2>
          {block.timestamp ? (
            <button
              type="button"
              className="timestamp-chip timestamp-chip--quiet"
              onClick={() => onPlay(block.timestamp!.seconds)}
            >
              <PlayIcon size={7} /> {formatTime(block.timestamp.seconds)}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (block.type === 'frame') {
    return <VideoFrame block={block} onPlay={onPlay} />
  }

  if (block.type === 'caption') {
    return (
      <div className="figure-caption">
        <p>{block.text}</p>
        {block.timestamp ? (
          <button
            type="button"
            className="timestamp-chip timestamp-chip--quiet"
            onClick={() => onPlay(block.timestamp!.seconds)}
          >
            <PlayIcon size={7} /> {formatTime(block.timestamp.seconds)}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <aside className="remember-card">
      <span className="remember-card__bar" aria-hidden="true" />
      <div>
        <span className="remember-card__label">{block.label}</span>
        <p>{block.text}</p>
      </div>
    </aside>
  )
}

function renderHighlighted(text: string, quote: string) {
  const parts = findQuote(text, quote)
  if (!parts) return text
  return (
    <>
      {parts.before}
      <mark className="quote-mark" data-active-quote="true">
        {parts.match}
      </mark>
      {parts.after}
    </>
  )
}

export function VideoFrame({
  block,
  onPlay,
}: {
  block: Extract<Block, { type: 'frame' }>
  onPlay: (seconds: number) => void
}) {
  return (
    <figure className="video-frame">
      <button
        type="button"
        className="video-frame__button"
        onClick={() => onPlay(block.timestamp.seconds)}
        aria-label={`Watch the video from ${formatTime(block.timestamp.seconds)}`}
      >
        <img src={block.src} alt={block.alt} loading="lazy" />
        <span className="video-frame__shade" aria-hidden="true" />
        <span className="video-frame__play" aria-hidden="true">
          <PlayIcon size={16} />
        </span>
        <span className="video-frame__watch">
          <YouTubeMark size={16} /> Watch from {formatTime(block.timestamp.seconds)}
        </span>
      </button>
      <figcaption>
        <span className="video-frame__figure">{block.figure}</span>
        <span className="video-frame__caption">{block.caption}</span>
        <button
          type="button"
          className="timestamp-chip timestamp-chip--quiet"
          onClick={() => onPlay(block.timestamp.seconds)}
        >
          <PlayIcon size={7} /> {formatTime(block.timestamp.seconds)}
        </button>
      </figcaption>
    </figure>
  )
}
