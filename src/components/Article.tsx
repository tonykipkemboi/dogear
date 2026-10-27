import { useRef, type SyntheticEvent } from 'react'
import type { Block, Chapter, Guide } from '../data/guide'
import { PlayIcon } from './Icons'
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
          <span className="meta-dot" aria-hidden="true" />
          <span>{chapter.diagramCount} diagrams</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{guide.webSourceCount} web source</span>
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

  if (block.type === 'diagram') {
    return <PrefillDecodeDiagram />
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

export function PrefillDecodeDiagram() {
  const grid = Array.from({ length: 16 })

  return (
    <figure className="phase-diagram">
      <div className="phase-diagram__panel">
        <div className="phase-diagram__head">
          <span>Prefill</span>
          <span>1 pass</span>
        </div>
        <div className="phase-diagram__visual phase-diagram__visual--prefill">
          <div className="phase-diagram__bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="phase-diagram__grid" aria-hidden="true">
            {grid.map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
        <p>
          Reads the whole prompt. <span>Compute-bound.</span>
        </p>
        <span className="phase-diagram__badge phase-diagram__badge--lime">
          TTFT <span>time to first token</span>
        </span>
      </div>

      <span className="phase-diagram__split" aria-hidden="true" />

      <div className="phase-diagram__panel">
        <div className="phase-diagram__head">
          <span>Decode</span>
          <span>1 token / pass</span>
        </div>
        <div className="phase-diagram__visual phase-diagram__visual--decode">
          <div className="phase-diagram__tokens" aria-hidden="true">
            <span>N</span>
            <span>N</span>
            <span>N</span>
            <span className="is-lime">a</span>
            <span className="is-lime">b</span>
            <span className="is-lime">c</span>
          </div>
        </div>
        <p>
          One token per full read. <span>Memory-bound.</span>
        </p>
        <span className="phase-diagram__badge phase-diagram__badge--dark">
          TPOT <span>time per output token</span>
        </span>
      </div>
    </figure>
  )
}
