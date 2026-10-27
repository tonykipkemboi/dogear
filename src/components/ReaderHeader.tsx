import type { Chapter, Guide } from '../data/guide'
import { Brand } from './Brand'
import { PoweredBy, YouTubeMark } from './Marks'
import { ChevronLeftIcon, PanelIcon } from './Icons'
import { Link } from '../lib/router'

export function ReaderHeader({
  guide,
  chapter,
  readView,
  onToggleRead,
  highlightsOpen,
  onShowHighlights,
}: {
  guide: Guide
  chapter: Chapter
  readView: boolean
  onToggleRead: () => void
  highlightsOpen: boolean
  onShowHighlights: () => void
}) {
  return (
    <header className="reader-header">
      <div className="reader-header__desktop">
        <div className="reader-header__left">
          <Brand height={24} />
          <span className="reader-header__rule" aria-hidden="true" />
          <span className="reader-header__source">
            <YouTubeMark size={15} />
            <span>{guide.title}</span>
          </span>
          <span className="reader-header__slash" aria-hidden="true">
            /
          </span>
          <span className="reader-header__chapter">
            {String(chapter.number).padStart(2, '0')} · {chapter.short}
          </span>
        </div>
        <div className="reader-header__right">
          <PoweredBy compact />
          {!readView && !highlightsOpen ? (
            <button type="button" className="highlights-toggle" onClick={onShowHighlights}>
              <span className="square-dot" aria-hidden="true" />
              Highlights
            </button>
          ) : null}
          <button
            type="button"
            className={`read-view-button ${readView ? 'is-active' : ''}`}
            onClick={onToggleRead}
            aria-pressed={readView}
          >
            <PanelIcon size={12} />
            Read view
          </button>
          <span className="avatar" title="Tony">
            TK
          </span>
        </div>
      </div>

      <div className="reader-header__mobile">
        <div className="reader-header__mobile-left">
          <Link to="/" className="reader-header__back" aria-label="Back to home">
            <ChevronLeftIcon size={17} />
          </Link>
          <div className="reader-header__mobile-copy">
            <span>{guide.title}</span>
            <span>
              {String(chapter.number).padStart(2, '0')} · {chapter.short}
            </span>
          </div>
        </div>
        <div className="reader-header__mobile-right">
          <span className="reader-header__count">
            {String(chapter.number).padStart(2, '0')} / {guide.chapterCount}
          </span>
          <button
            type="button"
            className={`read-view-button read-view-button--mobile ${readView ? 'is-active' : ''}`}
            onClick={onToggleRead}
            aria-pressed={readView}
          >
            <PanelIcon size={11} />
            Read view
          </button>
          <span className="avatar avatar--small" title="Tony">
            TK
          </span>
        </div>
      </div>
    </header>
  )
}
