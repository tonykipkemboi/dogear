import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { HighlightAction, Level, RecentHighlight, Source } from '../data/guide'
import { LEVELS } from '../data/guide'
import { getHighlightContent, type HighlightContent } from '../lib/content'
import { formatTime } from '../lib/format'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  SearchIcon,
  SendIcon,
} from './Icons'
import { TavilyMark } from './Marks'

export interface PanelMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

interface HighlightsPanelProps {
  quote: string | null
  action: HighlightAction
  level: Level
  content?: HighlightContent | null
  loading?: boolean
  recent: RecentHighlight[]
  sources: Source[]
  messages: PanelMessage[]
  asking: boolean
  searchingWeb: boolean
  onAction: (action: HighlightAction) => void
  onChangeLevel: (level: Level) => void
  onClose: () => void
  onPickHighlight: (highlight: RecentHighlight, action?: HighlightAction) => void
  onDeleteHighlight: (highlight: RecentHighlight) => void
  onEmptyAction: (action: HighlightAction) => void
  onOpenSource: (sourceId: string) => void
  onSearchWeb: () => void
  onAsk: (question: string) => void
}

const ACTIONS: { id: HighlightAction; label: string }[] = [
  { id: 'explain', label: 'Explain' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'example', label: 'Example' },
  { id: 'source', label: 'Source' },
]

export function HighlightsPanel({
  quote,
  action,
  level,
  content: contentOverride,
  loading = false,
  recent,
  sources,
  messages,
  asking,
  searchingWeb,
  onAction,
  onChangeLevel,
  onClose,
  onPickHighlight,
  onDeleteHighlight,
  onEmptyAction,
  onOpenSource,
  onSearchWeb,
  onAsk,
}: HighlightsPanelProps) {
  const [question, setQuestion] = useState('')
  const [showMath, setShowMath] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const content = contentOverride ?? getHighlightContent(action, level, quote ?? '', sources)

  useEffect(() => {
    setShowMath(false)
  }, [quote, action])

  useEffect(() => {
    if (!messages.length) return
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, asking])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = question.trim()
    if (!value || asking) return
    setQuestion('')
    onAsk(value)
  }

  return (
    <div className="highlights-panel">
      <div className="highlights-panel__head">
        <div className="highlights-panel__label">
          <span className="square-dot" aria-hidden="true" />
          <span>Highlights</span>
        </div>
        <div className="highlights-panel__head-right">
          <LevelMenu level={level} onChange={onChangeLevel} />
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close highlights">
            <CloseIcon size={15} />
          </button>
        </div>
      </div>

      <div className="highlights-panel__body" ref={scrollRef}>
        {quote ? (
          <div className="highlight-active">
            <div className="selected-quote">
              <span className="selected-quote__bar" aria-hidden="true" />
              <div>
                <span className="selected-quote__label">Highlighted</span>
                <p>“{quote}”</p>
              </div>
            </div>

            <div className="highlight-tabs" role="tablist" aria-label="Highlight actions">
              {ACTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={action === item.id}
                  className={`highlight-tabs__tab ${action === item.id ? 'is-active' : ''}`}
                  onClick={() => onAction(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="highlight-live-status" aria-live="polite">
                <span className="highlight-live-status__dot" aria-hidden="true" />
                Asking your connected model…
              </div>
            ) : null}

            <div className="highlight-content">
              <h3>{content.title}</h3>
              <p>{content.body}</p>
              {content.why ? (
                <div className="highlight-why">
                  <span>Why it matters here</span>
                  <p>{content.why}</p>
                </div>
              ) : null}

              {showMath && content.math ? (
                <div className="math-note">
                  <span className="mono-label">The math</span>
                  <p>{content.math}</p>
                </div>
              ) : null}

              {content.source ? (
                <div className="panel-source">
                  <div className="panel-source__head">
                    <span>
                      <span className="square-dot" aria-hidden="true" /> Beyond the video
                    </span>
                    <button type="button" className="panel-source__search" onClick={onSearchWeb}>
                      {searchingWeb ? 'Searching…' : 'Search the web'}
                      <SearchIcon size={11} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="source-card"
                    onClick={() => onOpenSource(content.source!.id)}
                  >
                    <TavilyMark size={18} />
                    <span className="source-card__copy">
                      <span>{content.source.title}</span>
                      <span>{content.source.domain}</span>
                    </span>
                    <span className="source-card__verified">
                      {content.source.verified ? <CheckIcon size={9} /> : null} Verified
                    </span>
                    <ArrowUpRightIcon size={12} />
                  </button>
                </div>
              ) : null}

              {recent.filter((item) => item.quote !== quote).length > 0 ? (
                <div className="recent-highlights recent-highlights--panel">
                  <span className="recent-highlights__label">Past highlights</span>
                  {recent
                    .filter((item) => item.quote !== quote)
                    .map((highlight) => (
                      <RecentHighlightRow
                        key={highlight.id}
                        highlight={highlight}
                        onPick={() => onPickHighlight(highlight)}
                        onDelete={() => onDeleteHighlight(highlight)}
                      />
                    ))}
                </div>
              ) : null}

              {content.chips ? (
                <div className="panel-chips">
                  {content.chips.map((chip) => {
                    if (chip === 'Show the math') {
                      return (
                        <button
                          key={chip}
                          type="button"
                          className={`panel-chip ${showMath ? 'is-active' : ''}`}
                          aria-pressed={showMath}
                          onClick={() => setShowMath((current) => !current)}
                        >
                          {showMath ? 'Hide the math' : chip}
                        </button>
                      )
                    }
                    const target = LEVELS.find(
                      (item) => item.label === chip || (chip === 'ELI22' && item.id === 'Expert'),
                    )?.id
                    if (!target) return null
                    return (
                      <button
                        key={chip}
                        type="button"
                        className={`panel-chip ${level === target ? 'is-active' : ''}`}
                        aria-pressed={level === target}
                        onClick={() => onChangeLevel(target)}
                      >
                        {chip}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="highlight-empty">
            <span className="panel-glyph" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <h3>Highlight anything.</h3>
            <p>Explain it, simplify it, see an example, or find the source.</p>
            <div className="empty-actions">
              {ACTIONS.map((item) => (
                <button key={item.id} type="button" onClick={() => onEmptyAction(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            {recent.length > 0 ? (
              <div className="recent-highlights">
                <span className="recent-highlights__label">Recent highlights</span>
                {recent.map((highlight) => (
                  <RecentHighlightRow
                    key={highlight.id}
                    highlight={highlight}
                    onPick={() => onPickHighlight(highlight)}
                    onDelete={() => onDeleteHighlight(highlight)}
                  />
                ))}
              </div>
            ) : null}
            <div className="panel-tip">
              <span className="mono-label">Tip</span>
              <p>Drag across any sentence. The four actions appear right above it.</p>
            </div>
          </div>
        )}

        {messages.length > 0 ? (
          <div className="panel-messages" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`panel-message panel-message--${message.role}`}>
                <span>{message.role === 'user' ? 'You' : 'Dogear'}</span>
                <p>{message.text}</p>
              </div>
            ))}
            {asking ? (
              <div className="panel-message panel-message--assistant panel-message--typing">
                <span>Dogear</span>
                <p>Reading the chapter…</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <form className="ask-form" onSubmit={submit}>
        <label htmlFor="ask-input" className="sr-only">
          Ask a follow-up
        </label>
        <input
          id="ask-input"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a follow-up…"
          autoComplete="off"
        />
        <button type="submit" className="ask-form__send" aria-label="Send question" disabled={asking}>
          {asking ? <span className="ask-form__spinner" /> : <SendIcon size={13} />}
        </button>
      </form>
    </div>
  )
}

function RecentHighlightRow({
  highlight,
  onPick,
  onDelete,
}: {
  highlight: RecentHighlight
  onPick: () => void
  onDelete: () => void
}) {
  const label = highlight.quote.length > 42 ? `${highlight.quote.slice(0, 42)}…` : highlight.quote
  return (
    <div className="recent-highlight-row">
      <button type="button" className="recent-highlight" onClick={onPick}>
        <span className="recent-highlight__bar" aria-hidden="true" />
        <span className="recent-highlight__copy">
          <span>“{highlight.quote}”</span>
          <span>▶ {formatTime(highlight.seconds)}</span>
        </span>
      </button>
      <button
        type="button"
        className="recent-highlight__delete"
        onClick={onDelete}
        aria-label={`Delete highlight: ${label}`}
        title="Remove highlight"
      >
        <CloseIcon size={10} />
      </button>
    </div>
  )
}

function LevelMenu({ level, onChange }: { level: Level; onChange: (level: Level) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="level-menu" ref={ref}>
      <button
        type="button"
        className="level-pill"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="square-dot" aria-hidden="true" />
        {level}
        <ChevronDownIcon size={11} />
      </button>
      {open ? (
        <div className="level-menu__list" role="listbox" aria-label="Reading level">
          {LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === level}
              className={item.id === level ? 'is-active' : ''}
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
            >
              <span>{item.label}</span>
              <span>{item.short}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function MobileReaderBar({
  hasQuote,
  action,
  onOpen,
}: {
  hasQuote: boolean
  action: HighlightAction
  onOpen: () => void
}) {
  return (
    <button type="button" className="reader-mobile-bar" onClick={onOpen}>
      <span className="reader-mobile-bar__label">
        <span className="square-dot" aria-hidden="true" />
        Highlights
      </span>
      <span className="reader-mobile-bar__action">
        {hasQuote ? `Edit ${action}` : 'Select a sentence'}
        <ChevronRightIcon size={12} className="reader-mobile-bar__chevron" />
      </span>
    </button>
  )
}

export function HighlightToolbar({
  top,
  left,
  action,
  onAction,
}: {
  top: number
  left: number
  action: HighlightAction
  onAction: (action: HighlightAction) => void
}) {
  return (
    <div
      className="highlight-toolbar"
      style={{ top, left }}
      role="toolbar"
      aria-label="Highlight actions"
      onMouseDown={(event) => event.preventDefault()}
    >
      {ACTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={action === item.id ? 'is-active' : ''}
          onClick={() => onAction(item.id)}
        >
          {item.label}
        </button>
      ))}
      <span className="highlight-toolbar__pointer" aria-hidden="true" />
    </div>
  )
}

export function SourceActionLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="inline-source-link" onClick={onClick}>
      Read the source <ArrowRightIcon size={12} />
    </button>
  )
}
