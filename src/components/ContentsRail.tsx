import type { Chapter, Guide } from '../data/guide'
import { PlayIcon } from './Icons'
import { formatTime } from '../lib/format'

export function ContentsList({
  guide,
  chapter,
  onSelect,
  mobile = false,
}: {
  guide: Guide
  chapter: Chapter
  onSelect: (chapter: Chapter) => void
  mobile?: boolean
}) {
  return (
    <div className={`contents-list ${mobile ? 'contents-list--mobile' : ''}`}>
      <div className="contents-list__head">
        <span>Contents</span>
        <span>{String(guide.chapterCount).padStart(2, '0')} ch</span>
      </div>
      {guide.chapters.map((item) => {
        const active = item.id === chapter.id
        return (
          <button
            key={item.id}
            type="button"
            className={`contents-list__item ${active ? 'is-active' : ''}`}
            onClick={() => onSelect(item)}
            aria-current={active ? 'true' : undefined}
          >
            <span className="contents-list__number">{String(item.number).padStart(2, '0')}</span>
            <span className="contents-list__title">{item.short}</span>
            {active ? <PlayIcon size={7} className="contents-list__play" /> : null}
            <span className="contents-list__time">{formatTime(item.start)}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ContentsRail({
  guide,
  chapter,
  onSelect,
  notesCount,
  onExport,
}: {
  guide: Guide
  chapter: Chapter
  onSelect: (chapter: Chapter) => void
  notesCount: number
  onExport: () => void
}) {
  return (
    <aside className="contents-rail" aria-label="Contents">
      <ContentsList guide={guide} chapter={chapter} onSelect={onSelect} />
      <div className="contents-rail__foot">
        <div className="contents-rail__meta">
          <span>{Math.round(guide.progress * 100)}% read</span>
          <span>{guide.minutesLeft ?? Math.max(1, Math.round(guide.readMinutes * (1 - guide.progress)))} min left</span>
        </div>
        <div className="contents-rail__progress" aria-hidden="true">
          <span style={{ width: `${guide.progress * 100}%` }} />
        </div>
        <button type="button" className="contents-rail__export" onClick={onExport}>
          Export notes <span aria-hidden="true">↗</span>
          {notesCount > 0 ? <span className="contents-rail__count">{notesCount}</span> : null}
        </button>
      </div>
    </aside>
  )
}
