import type { Source } from '../data/guide'
import { Dialog } from './Dialog'
import { ArrowRightIcon, ArrowUpRightIcon, CloseIcon } from './Icons'
import { useIsMobile } from '../lib/useMediaQuery'

export function SourceDialog({
  open,
  sources,
  source,
  quote,
  onSelect,
  onClose,
  onAddNote,
}: {
  open: boolean
  sources: Source[]
  source: Source
  quote: string
  onSelect: (sourceId: string) => void
  onClose: () => void
  onAddNote: (source: Source) => void
}) {
  const mobile = useIsMobile()
  const index = Math.max(1, sources.findIndex((item) => item.id === source.id) + 1)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sheet={mobile}
      className={`source-dialog ${mobile ? 'source-dialog--mobile' : 'source-dialog--desktop'}`}
      labelledBy="source-title"
    >
      {mobile ? (
        <MobileSource
          sources={sources}
          source={source}
          quote={quote}
          onSelect={onSelect}
          onClose={onClose}
          onAddNote={onAddNote}
        />
      ) : (
        <DesktopSource
          sources={sources}
          source={source}
          quote={quote}
          index={index}
          onSelect={onSelect}
          onClose={onClose}
          onAddNote={onAddNote}
        />
      )}
    </Dialog>
  )
}

function DesktopSource({
  sources,
  source,
  quote,
  index,
  onSelect,
  onClose,
  onAddNote,
}: {
  sources: Source[]
  source: Source
  quote: string
  index: number
  onSelect: (sourceId: string) => void
  onClose: () => void
  onAddNote: (source: Source) => void
}) {
  return (
    <>
      <aside className="source-rail" aria-label="Sources">
        <div className="source-rail__head">
          <span>Sources</span>
          <span>{sources.length}</span>
        </div>
        {sources.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`source-rail__card ${item.id === source.id ? 'is-active' : ''}`}
            onClick={() => onSelect(item.id)}
            aria-pressed={item.id === source.id}
          >
            <span className="source-rail__title">
              {item.short}: {item.title}
              {item.id === sources[0]?.id ? <span className="source-rail__used">Used</span> : null}
            </span>
            <span className="source-rail__domain">{item.domain}</span>
            <span className="source-rail__snippet">{item.keyPoints[0] ?? item.extract[0]}</span>
          </button>
        ))}
        <span className="source-rail__foot">Results from Tavily</span>
      </aside>

      <div className="source-main">
        <div className="source-main__top">
          <span>
            Source {index} of {sources.length}
          </span>
          <div>
            <span>{source.domain}</span>
            <button type="button" className="source-main__close" onClick={onClose}>
              Close <CloseIcon size={11} />
            </button>
          </div>
        </div>
        <h2 id="source-title" className="source-main__title">
          {source.title}
        </h2>
        <div className="source-main__meta">
          {source.domain} · {source.published} · via Tavily
        </div>
        <div className="source-main__used">
          <span className="mono-label">Used in this explanation</span>
          <div>
            <span className="source-main__bar" aria-hidden="true" />
            <p>“{quote || source.usedFor}”</p>
          </div>
        </div>
        <p className="source-main__extract">{source.extract[0]}</p>
        {source.keyPoints.length > 0 ? (
          <div className="source-main__points">
            <span className="mono-label">Key points</span>
            <ul>
              {source.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="source-main__foot">
          <a href={source.url} target="_blank" rel="noreferrer">
            Open original <ArrowUpRightIcon size={11} />
          </a>
          <button type="button" className="source-main__add" onClick={() => onAddNote(source)}>
            Add to notes <ArrowRightIcon size={12} />
          </button>
        </div>
      </div>
    </>
  )
}

function MobileSource({
  sources,
  source,
  quote,
  onSelect,
  onClose,
  onAddNote,
}: {
  sources: Source[]
  source: Source
  quote: string
  onSelect: (sourceId: string) => void
  onClose: () => void
  onAddNote: (source: Source) => void
}) {
  return (
    <>
      <div className="sheet-grab" aria-hidden="true" />
      <div className="source-dialog__head">
        <span className="source-dialog__eyebrow">Sources</span>
        <button type="button" className="source-dialog__close" onClick={onClose}>
          Close <CloseIcon size={12} />
        </button>
      </div>

      <div className="source-dialog__body">
        <div className="source-chips" role="tablist" aria-label="Sources">
          {sources.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === source.id}
              className={item.id === source.id ? 'is-active' : ''}
              onClick={() => onSelect(item.id)}
            >
              {item.short}
            </button>
          ))}
        </div>

        <h2 id="source-title" className="source-dialog__title">
          {source.title}
        </h2>
        <div className="source-dialog__meta">
          <span>{source.domain}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{source.published}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>via Tavily</span>
        </div>

        <div className="source-used">
          <span className="mono-label">Used in this explanation</span>
          <p>“{quote || source.usedFor}”</p>
        </div>

        <div className="source-extract">
          {source.extract.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {source.keyPoints.length > 0 ? (
          <div className="source-points">
            <span className="mono-label">Key points</span>
            <ul>
              {source.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="source-details">
          <span className="mono-label">Source details</span>
          <p>
            Published {source.published} · {source.readTime}
          </p>
        </div>

        {source.more.length > 0 ? (
          <div className="source-more">
            <span className="mono-label">More from this source</span>
            {source.more.map((item) => (
              <a key={item.title} href={item.href} target="_blank" rel="noreferrer">
                <span>{item.title}</span>
                <ArrowUpRightIcon size={12} />
              </a>
            ))}
          </div>
        ) : null}

        <div className="source-why">
          <span className="mono-label">Why this source</span>
          <p>{source.why}</p>
        </div>
      </div>

      <div className="source-dialog__foot">
        <a href={source.url} target="_blank" rel="noreferrer" className="source-original">
          Open original <ArrowUpRightIcon size={12} />
        </a>
        <button type="button" className="button button--dark source-add" onClick={() => onAddNote(source)}>
          Add to notes <ArrowRightIcon size={14} />
        </button>
      </div>
    </>
  )
}
