import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Chapter, Guide, HighlightAction, Level, RecentHighlight, Source } from '../data/guide'
import { DEFAULT_LEVEL, getChapter, getSource, SEEDED_GUIDE } from '../data/guide'
import { ask as askQuestion, searchWeb } from '../lib/api'
import { getHighlightContent, localAnswer, type HighlightContent } from '../lib/content'
import { clamp } from '../lib/format'
import { navigate, setSearchParam, useLocation } from '../lib/router'
import {
  readLevel,
  readNotes,
  readPrefs,
  readRecentHighlights,
  writeRecentHighlights,
  addNote,
  downloadNotes,
  writeLevel,
  type SavedNote,
} from '../lib/storage'
import { useMediaQuery } from '../lib/useMediaQuery'
import { Article, type SelectionAnchor } from './Article'
import { ContentsRail } from './ContentsRail'
import { Dialog } from './Dialog'
import {
  HighlightsPanel,
  HighlightToolbar,
  MobileReaderBar,
  type PanelMessage,
} from './HighlightsPanel'
import { ReaderHeader } from './ReaderHeader'
import { ContentsSheet, NotesSheet, TranscriptSheet } from './ReaderSheets'
import { SourceDialog } from './SourceDialog'
import { useToast } from './Toast'
import { InlineVideo, MiniPlayer, PlaybackDock, VideoDialog, VideoPlayer } from './Video'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

interface QuoteState {
  text: string
  action: HighlightAction
}

interface ToolbarState {
  top: number
  left: number
  width: number
  bottom: number
}

export function Reader() {
  const location = useLocation()
  const pathname = location.split('?')[0]
  const search = new URLSearchParams(location.split('?')[1]?.split('#')[0] ?? '')
  const guideId = pathname.split('/')[2] || SEEDED_GUIDE.id
  const chapterId = search.get('chapter')
  const [guide, setGuide] = useState<Guide>(SEEDED_GUIDE)
  const [loading, setLoading] = useState(guideId !== SEEDED_GUIDE.id)
  const chapter = getChapter(
    guide,
    chapterId ?? (guide.id === SEEDED_GUIDE.id ? 'kv-cache' : guide.chapters[0]?.id),
  )
  const readView = search.get('view') === 'read'
  const mobile = useMediaQuery('(max-width: 960px)')
  const { notify } = useToast()

  const [level, setLevel] = useState<Level>(() => readLevel() || DEFAULT_LEVEL)
  const [quote, setQuote] = useState<QuoteState | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [readPanelOpen, setReadPanelOpen] = useState(false)
  const [showPanel, setShowPanel] = useState(true)
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null)
  const [toolbarMuted, setToolbarMuted] = useState(false)
  const [selectionAnchor, setSelectionAnchor] = useState<ToolbarState | null>(null)
  const [recent, setRecent] = useState<RecentHighlight[]>(() =>
    readRecentHighlights(SEEDED_GUIDE.recentHighlights, SEEDED_GUIDE.id),
  )
  const [messages, setMessages] = useState<PanelMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [liveHighlight, setLiveHighlight] = useState<HighlightContent | null>(null)
  const [highlightLoading, setHighlightLoading] = useState(false)
  const liveCache = useRef(new Map<string, HighlightContent>())
  const [notes, setNotes] = useState<SavedNote[]>(() => readNotes())
  const [sources, setSources] = useState<Source[]>(guide.sources)
  const [sourceId, setSourceId] = useState(guide.sources[0].id)
  const [sourceQuote, setSourceQuote] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [searchingWeb, setSearchingWeb] = useState(false)
  const [video, setVideo] = useState<{ open: boolean; start: number }>({ open: false, start: 0 })
  const [inlineVideo, setInlineVideo] = useState<number | null>(null)
  const [contentsOpen, setContentsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const prefs = readPrefs()

  useEffect(() => {
    if (guideId === SEEDED_GUIDE.id) {
      setGuide(SEEDED_GUIDE)
      setLoading(false)
      return
    }
    const cached = sessionStorage.getItem(`dogear.guide.${guideId}`)
    if (cached) {
      try {
        setGuide(JSON.parse(cached) as Guide)
        setLoading(false)
        return
      } catch {
        // Fall through to the server.
      }
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/guides/${encodeURIComponent(guideId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Guide not found.')
        return (await response.json()) as Guide
      })
      .then((data) => {
        if (cancelled) return
        setGuide(data)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setGuide(SEEDED_GUIDE)
          setLoading(false)
          notify('Guide not found. Opened the demo instead.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [guideId, notify])

  useEffect(() => {
    setRecent(readRecentHighlights(guide.recentHighlights, guide.id))
    setSources(guide.sources)
    setSourceId(guide.sources[0]?.id ?? 'vllm-prefix')
    setShowPanel(true)
    setInlineVideo(null)
  }, [guide.id, guide.recentHighlights, guide.sources])

  useEffect(() => {
    writeLevel(level)
  }, [level])

  useEffect(() => {
    if (guide.level) setLevel(guide.level)
  }, [guide.id, guide.level])

  useEffect(() => {
    if (loading || !chapterId) return
    if (!guide.chapters.some((item) => item.id === chapterId) && guide.chapters[0]) {
      setSearchParam('chapter', guide.chapters[0].id, true)
    }
  }, [chapterId, guide, loading])

  const selectChapter = useCallback(
    (next: Chapter) => {
      setQuote(null)
      setSheetOpen(false)
      setMessages([])
      setContentsOpen(false)
      setInlineVideo(null)
      setVideo({ open: false, start: 0 })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      navigate(`/read/${guide.id}?chapter=${next.id}${readView ? '&view=read' : ''}`)
    },
    [guide.id, readView],
  )

  const playInline = useCallback((seconds: number, scroll = true) => {
    setInlineVideo(seconds)
    setVideo({ open: false, start: 0 })
    if (scroll) {
      window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>('.video-player, .read-inline-video')
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    }
  }, [])

  const expandVideo = useCallback((seconds: number) => {
    setInlineVideo(null)
    setVideo({ open: true, start: seconds })
  }, [])

  const toggleReadView = () => {
    if (!readView) {
      setSheetOpen(false)
      setSourceOpen(false)
    }
    setSearchParam('view', readView ? null : 'read', false)
  }

  const changeLevel = useCallback((next: Level) => {
    setLiveHighlight(null)
    setLevel(next)
  }, [])

  const addRecent = useCallback((text: string) => {
    const next: RecentHighlight = {
      id: `h-${Date.now()}`,
      quote: text,
      chapterId: chapter.id,
      seconds: chapter.start,
    }
    setRecent((current) => {
      const updated = [next, ...current.filter((item) => item.quote !== text)].slice(0, 8)
      writeRecentHighlights(updated, guide.id)
      return updated
    })
  }, [chapter.id, chapter.start, guide.id])

  const deleteRecent = useCallback(
    (highlight: RecentHighlight) => {
      setRecent((current) => {
        const updated = current.filter((item) => item.id !== highlight.id)
        writeRecentHighlights(updated, guide.id)
        return updated
      })
      notify('Highlight removed.', 'success')
    },
    [notify, guide.id],
  )

  const applyAction = useCallback(
    (nextAction: HighlightAction) => {
      if (!quote) return
      setLiveHighlight(null)
      setQuote({ ...quote, action: nextAction })
      if (!mobile && !readView) setShowPanel(true)
      if (mobile) {
        setSheetOpen(true)
      } else if (readView) {
        setReadPanelOpen(true)
      }
    },
    [quote, mobile, readView],
  )

  const selectText = useCallback(
    (text: string, anchor: SelectionAnchor) => {
      const nextQuote: QuoteState = { text, action: 'explain' }
      setToolbarMuted(false)
      setLiveHighlight(null)
      setQuote(nextQuote)
      setSelectionAnchor(anchor)
      setSheetOpen(false)
      setMessages([])
      addRecent(text)
    },
    [addRecent],
  )

  const pickHighlight = useCallback(
    (highlight: RecentHighlight, action: HighlightAction = 'explain') => {
      const nextQuote: QuoteState = { text: highlight.quote, action }
      setToolbarMuted(false)
      setLiveHighlight(null)
      setQuote(nextQuote)
      setSelectionAnchor(null)
      setMessages([])
      if (mobile) {
        setSheetOpen(true)
      } else {
        window.setTimeout(() => {
          document
            .querySelector<HTMLElement>('.article [data-active-quote]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 70)
      }
    },
    [mobile],
  )

  const emptyAction = useCallback(
    (action: HighlightAction) => {
      const first = recent[0]
      if (!first) {
        notify('Select a sentence first.', 'default')
        return
      }
      setToolbarMuted(false)
      setLiveHighlight(null)
      setQuote({ text: first.quote, action })
      setMessages([])
      if (mobile) setSheetOpen(true)
    },
    [recent, mobile, notify],
  )

  const closePanel = () => {
    setQuote(null)
    setSheetOpen(false)
    setToolbar(null)
    setToolbarMuted(false)
    setMessages([])
  }

  const hideHighlights = () => {
    setShowPanel(false)
    closePanel()
  }

  useEffect(() => {
    if (!quote || sheetOpen || toolbarMuted) {
      setToolbar(null)
      return undefined
    }
    let frame = 0
    const update = () => {
      const mark = document.querySelector<HTMLElement>('.article [data-active-quote]')
      if (!mark) {
        setToolbar(selectionAnchor)
        return
      }
      const rect = mark.getBoundingClientRect()
      if (rect.bottom < 70 || rect.top > window.innerHeight - 24) {
        setToolbar(null)
        return
      }
      const width = 300
      setToolbar({
        top: clamp(rect.top - 46, 74, window.innerHeight - 58),
        left: clamp(rect.left, 12, window.innerWidth - width - 12),
        width,
        bottom: rect.bottom,
      })
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }
    update()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [quote, sheetOpen, selectionAnchor, toolbarMuted])

  useEffect(() => {
    if (!quote || !toolbar || sheetOpen) return undefined
    const dismiss = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.highlight-toolbar')) return
      setToolbarMuted(true)
      setToolbar(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setToolbarMuted(true)
      setToolbar(null)
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [quote, toolbar, sheetOpen])

  useEffect(() => {
    if (!sheetOpen && !sourceOpen && !video.open && !contentsOpen && !notesOpen && !transcriptOpen && inlineVideo === null) return
    setToolbar(null)
  }, [sheetOpen, sourceOpen, video.open, contentsOpen, notesOpen, transcriptOpen, inlineVideo])

  useEffect(() => {
    if (!quote) setReadPanelOpen(false)
  }, [quote])

  const openSource = (id: string) => {
    setSourceId(id)
    setSourceQuote(quote?.text ?? sourceQuote)
    setSourceOpen(true)
    if (mobile) setSheetOpen(false)
  }

  const handleSearchWeb = async () => {
    if (!prefs.webSearch) {
      notify('Web research is off. Turn it on in Keys.')
      return
    }
    setSearchingWeb(true)
    try {
      const query = quote?.text || `${chapter.title} ${chapter.short}`
      const result = await searchWeb(query)
      if (result.sources.length > 0) {
        setSources((current) => {
          const ids = new Set(current.map((item) => item.id))
          return [...current, ...result.sources.filter((item) => !ids.has(item.id))]
        })
        setSourceId(result.sources[0].id)
        setSourceQuote(quote?.text || result.sources[0].usedFor)
        setSourceOpen(true)
        if (mobile) setSheetOpen(false)
        notify(result.demo ? 'Showing saved sources. Add a Tavily key for live search.' : `Found ${result.sources.length} web sources.`)
      } else {
        notify('No new sources came back.')
      }
    } catch {
      notify('Web search is unavailable right now.', 'error')
    } finally {
      setSearchingWeb(false)
    }
  }

  const chapterContext = useMemo(
    () =>
      chapter.blocks
        .filter((block) => block.type === 'p' || block.type === 'callout')
        .map((block) => ('text' in block ? block.text : ''))
        .join('\n\n'),
    [chapter],
  )

  useEffect(() => {
    const current = quote
    if (!current || current.action === 'source') {
      setLiveHighlight(null)
      setHighlightLoading(false)
      return undefined
    }

    const cacheKey = `${chapter.id}|${level}|${prefs.model}|${current.action}|${current.text}`
    const cached = liveCache.current.get(cacheKey)
    if (cached) {
      setLiveHighlight(cached)
      setHighlightLoading(false)
      return undefined
    }

    setLiveHighlight(null)
    setHighlightLoading(true)
    let cancelled = false
    const prompt =
      current.action === 'simplify'
        ? `Explain the highlighted passage as simply as possible for a ${level} reader. Keep the chapter's meaning.`
        : current.action === 'example'
          ? `Give one concrete example that makes the highlighted passage clear. Stay inside the chapter context.`
          : `Explain the highlighted passage in the context of this chapter. Start with the idea, then show how it works.`

    askQuestion({
      question: `${prompt} Chapter: ${chapter.title}`,
      quote: current.text,
      context: chapterContext,
      level,
      model: prefs.model,
    })
      .then((result) => {
        if (cancelled) return
        const local = getHighlightContent(current.action, level, current.text, sources, chapter)
        const next: HighlightContent = { ...local, body: result.answer }
        liveCache.current.set(cacheKey, next)
        setLiveHighlight(next)
      })
      .catch(() => {
        if (!cancelled) setLiveHighlight(null)
      })
      .finally(() => {
        if (!cancelled) setHighlightLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [quote, level, chapter, chapterContext, prefs.model, sources])

  const localHighlightContent = quote
    ? getHighlightContent(quote.action, level, quote.text, sources, chapter)
    : null
  const panelContent =
    quote?.action === 'source' ? localHighlightContent : liveHighlight ?? localHighlightContent

  const handleAsk = async (question: string) => {
    const userMessage: PanelMessage = { id: `u-${Date.now()}`, role: 'user', text: question }
    setMessages((current) => [...current, userMessage])
    setAsking(true)
    try {
      const result = await askQuestion({
        question,
        quote: quote?.text,
        context: chapterContext,
        level,
        model: prefs.model,
      })
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: 'assistant', text: result.answer },
      ])
    } catch {
      notify('Nebius is not connected. This answer came from the chapter.', 'error')
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: 'assistant', text: localAnswer(question, chapter) },
      ])
    } finally {
      setAsking(false)
    }
  }

  const handleAddNote = (source: Source) => {
    const next = addNote({
      quote: sourceQuote || quote?.text || source.usedFor,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      sourceId: source.id,
    })
    setNotes(readNotes())
    notify(`Added “${next.quote.slice(0, 36)}${next.quote.length > 36 ? '…' : ''}” to notes.`, 'success')
  }

  const handleExport = () => {
    if (notes.length === 0) {
      notify('No notes yet. Add a source or highlight first.')
      return
    }
    downloadNotes(notes, guide.title)
    notify('Notes exported as Markdown.', 'success')
  }

  const selectedSource = sources.find((item) => item.id === sourceId) ?? sources[0] ?? getSource('vllm-prefix')
  const renderPanel = (onClose: () => void) => (
    <HighlightsPanel
      quote={quote?.text ?? null}
      action={quote?.action ?? 'explain'}
      level={level}
      content={panelContent}
      loading={highlightLoading}
      recent={recent}
      sources={sources}
      messages={messages}
      asking={asking}
      searchingWeb={searchingWeb}
      onAction={applyAction}
      onChangeLevel={changeLevel}
      onClose={onClose}
      onPickHighlight={pickHighlight}
      onDeleteHighlight={deleteRecent}
      onEmptyAction={emptyAction}
      onOpenSource={openSource}
      onSearchWeb={handleSearchWeb}
      onAsk={handleAsk}
    />
  )

  if (loading) {
    return (
      <div className="page page--reader">
        <ReaderHeader
          guide={guide}
          chapter={chapter}
          readView={readView}
          onToggleRead={toggleReadView}
          highlightsOpen={showPanel}
          onShowHighlights={() => setShowPanel(true)}
        />
        <div className="reader-loading">
          <span className="square-dot" aria-hidden="true" />
          Loading the guide…
        </div>
      </div>
    )
  }

  return (
    <div className={`page page--reader ${readView ? 'is-read-view' : ''}`}>
      <ReaderHeader
        guide={guide}
        chapter={chapter}
        readView={readView}
        onToggleRead={toggleReadView}
        highlightsOpen={showPanel}
        onShowHighlights={() => setShowPanel(true)}
      />

      <div className={`reader-shell ${!readView && !showPanel ? 'is-panel-closed' : ''}`}>
        {!readView ? (
          <ContentsRail
            guide={guide}
            chapter={chapter}
            onSelect={selectChapter}
            notesCount={notes.length}
            onExport={handleExport}
          />
        ) : null}

        <main className="reader-main">
          {readView ? (
            <div className="reader-main__read-tools">
              <button type="button" className="read-contents-button" onClick={() => setContentsOpen(true)}>
                <span aria-hidden="true">☰</span> Contents
              </button>
              <span className="reader-main__read-count">
                {String(chapter.number).padStart(2, '0')} / {guide.chapterCount}
              </span>
            </div>
          ) : null}
          {readView ? (
            inlineVideo !== null ? (
              <div className="reader-main__mini read-inline-video">
                <InlineVideo
                  guide={guide}
                  start={inlineVideo}
                  onClose={() => setInlineVideo(null)}
                  onExpand={() => expandVideo(inlineVideo)}
                />
              </div>
            ) : (
              <div className="reader-main__mini">
                <MiniPlayer
                  guide={guide}
                  chapter={chapter}
                  onPlay={(seconds) => playInline(seconds, false)}
                  onExpand={expandVideo}
                />
              </div>
            )
          ) : (
            <VideoPlayer
              guide={guide}
              chapter={chapter}
              inlineStart={inlineVideo}
              onPlay={(seconds) => playInline(seconds, false)}
              onClose={() => setInlineVideo(null)}
              onExpand={expandVideo}
            />
          )}
          <Article
            guide={guide}
            chapter={chapter}
            activeQuote={quote?.text ?? null}
            onSelectText={selectText}
            onPlay={playInline}
          />
          <ChapterNav guide={guide} chapter={chapter} onSelect={selectChapter} />
        </main>

        {!readView && showPanel ? (
          <aside className="highlights-aside" aria-label="Highlights">
            {renderPanel(hideHighlights)}
          </aside>
        ) : null}
      </div>

      <PlaybackDock
        guide={guide}
        chapter={chapter}
        onPlay={playInline}
        onTranscript={() => setTranscriptOpen(true)}
        onNotes={() => setNotesOpen(true)}
      />

      {!readView ? (
        <MobileReaderBar hasQuote={Boolean(quote)} action={quote?.action ?? 'explain'} onOpen={() => setSheetOpen(true)} />
      ) : (
        <button
          type="button"
          className="read-highlights-fab"
          onClick={() => setSheetOpen(true)}
          aria-label="Open highlights"
        >
          <span className="square-dot" aria-hidden="true" />
          Highlights
        </button>
      )}

      {toolbar && quote ? (
        <HighlightToolbar
          top={toolbar.top}
          left={toolbar.left}
          action={quote.action}
          onAction={applyAction}
        />
      ) : null}

      {mobile ? (
        <Dialog
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          sheet
          className="highlights-sheet"
          labelledBy="highlights-sheet-title"
        >
          <div className="sheet-grab" aria-hidden="true" />
          <span id="highlights-sheet-title" className="sr-only">
            Highlights
          </span>
          {renderPanel(closePanel)}
        </Dialog>
      ) : null}

      {!mobile ? (
        <Dialog
          open={readPanelOpen && readView && Boolean(quote)}
          onClose={() => {
            setReadPanelOpen(false)
            closePanel()
          }}
          className="read-panel-dialog"
          labelledBy="read-panel-title"
        >
          <span id="read-panel-title" className="sr-only">
            Highlights
          </span>
          {renderPanel(closePanel)}
        </Dialog>
      ) : null}

      <SourceDialog
        open={sourceOpen}
        sources={sources}
        source={selectedSource}
        quote={sourceQuote}
        onSelect={(id) => setSourceId(id)}
        onClose={() => setSourceOpen(false)}
        onAddNote={handleAddNote}
      />
      <VideoDialog
        guide={guide}
        open={video.open}
        start={video.start}
        onClose={() => setVideo({ open: false, start: 0 })}
      />
      <ContentsSheet
        open={contentsOpen}
        guide={guide}
        chapter={chapter}
        onSelect={selectChapter}
        onClose={() => setContentsOpen(false)}
      />
      <NotesSheet
        open={notesOpen}
        notes={notes}
        onClose={() => setNotesOpen(false)}
        onExport={handleExport}
      />
      <TranscriptSheet
        open={transcriptOpen}
        guide={guide}
        chapter={chapter}
        onSelect={selectChapter}
        onClose={() => setTranscriptOpen(false)}
      />
    </div>
  )
}

function ChapterNav({
  guide,
  chapter,
  onSelect,
}: {
  guide: Guide
  chapter: Chapter
  onSelect: (chapter: Chapter) => void
}) {
  const index = guide.chapters.findIndex((item) => item.id === chapter.id)
  const previous = guide.chapters[index - 1]
  const next = guide.chapters[index + 1]
  return (
    <nav className="chapter-nav" aria-label="Chapters">
      {previous ? (
        <button type="button" className="chapter-nav__button" onClick={() => onSelect(previous)}>
          <ChevronLeftIcon size={13} />
          <span>
            {String(previous.number).padStart(2, '0')} · {previous.short}
          </span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button type="button" className="chapter-nav__button chapter-nav__button--next" onClick={() => onSelect(next)}>
          <span>
            {String(next.number).padStart(2, '0')} · {next.short}
          </span>
          <ChevronRightIcon size={13} />
        </button>
      ) : (
        <span />
      )}
    </nav>
  )
}
