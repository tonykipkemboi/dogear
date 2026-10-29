import { useEffect, useState } from 'react'
import type { Chapter, Guide } from '../data/guide'
import type { SavedNote } from '../lib/storage'
import { getTranscript } from '../lib/api'
import { Dialog } from './Dialog'
import { ArrowUpRightIcon, CloseIcon, PlayIcon } from './Icons'
import { ContentsList } from './ContentsRail'
import { formatTime, youtubeWatchUrl } from '../lib/format'

export function ContentsSheet({
  open,
  guide,
  chapter,
  onSelect,
  onClose,
}: {
  open: boolean
  guide: Guide
  chapter: Chapter
  onSelect: (chapter: Chapter) => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} sheet className="contents-sheet" labelledBy="contents-sheet-title">
      <div className="sheet-grab" aria-hidden="true" />
      <div className="sheet-head">
        <h2 id="contents-sheet-title">Contents</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close contents">
          <CloseIcon size={16} />
        </button>
      </div>
      <ContentsList
        guide={guide}
        chapter={chapter}
        onSelect={(item) => {
          onSelect(item)
          onClose()
        }}
        mobile
      />
    </Dialog>
  )
}

export function NotesSheet({
  open,
  notes,
  onClose,
  onExport,
}: {
  open: boolean
  notes: SavedNote[]
  onClose: () => void
  onExport: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} sheet className="notes-sheet" labelledBy="notes-title">
      <div className="sheet-grab" aria-hidden="true" />
      <div className="sheet-head">
        <div>
          <span className="mono-label">Your copy</span>
          <h2 id="notes-title">Notes</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close notes">
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="notes-sheet__body">
        {notes.length === 0 ? (
          <p className="notes-empty">Highlight a passage, or add a source, and it will land here.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="note-row">
              <span className="note-row__bar" aria-hidden="true" />
              <div>
                <span className="note-row__meta">Chapter {String(note.chapterNumber).padStart(2, '0')}</span>
                <p>“{note.quote}”</p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="notes-sheet__foot">
        <button type="button" className="button button--ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="button button--dark" onClick={onExport} disabled={notes.length === 0}>
          Export notes <ArrowUpRightIcon size={13} />
        </button>
      </div>
    </Dialog>
  )
}

export function TranscriptSheet({
  open,
  guide,
  chapter,
  onSelect,
  onPlay,
  onClose,
}: {
  open: boolean
  guide: Guide
  chapter: Chapter
  onSelect: (chapter: Chapter) => void
  onPlay: (seconds: number) => void
  onClose: () => void
}) {
  const [remote, setRemote] = useState<{ start: number; text: string }[] | null>(null)
  const [loadingTranscript, setLoadingTranscript] = useState(false)

  useEffect(() => {
    if (!open || guide.transcript?.length) return
    let cancelled = false
    setLoadingTranscript(true)
    getTranscript(guide.youtubeId)
      .then((result) => {
        if (!cancelled) setRemote(result.transcript)
      })
      .catch(() => {
        if (!cancelled) setRemote([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTranscript(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, guide.youtubeId, guide.transcript])

  const transcript = groupTranscript(guide.transcript?.length ? guide.transcript : remote ?? [])
  return (
    <Dialog open={open} onClose={onClose} sheet className="transcript-sheet" labelledBy="transcript-title">
      <div className="sheet-grab" aria-hidden="true" />
      <div className="sheet-head">
        <div>
          <span className="mono-label">
            {transcript.length ? 'Word for word' : loadingTranscript ? 'Loading' : 'Chapter map'}
          </span>
          <h2 id="transcript-title">Transcript</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close transcript">
          <CloseIcon size={16} />
        </button>
      </div>
      <p className="transcript-intro">
        {transcript.length
          ? 'Click any passage to watch from that moment.'
          : loadingTranscript
            ? 'Loading the video transcript…'
            : 'Dogear’s chapter map is below. The video’s word-for-word transcript lives on YouTube.'}
      </p>
      <div className="transcript-list">
        {transcript.length
          ? transcript.map((cue, index) => (
              <button
                key={`${cue.start}-${index}`}
                type="button"
                className="transcript-cue"
                onClick={() => {
                  onPlay(cue.start)
                  onClose()
                }}
              >
                <span className="transcript-row__time">{formatTime(cue.start)}</span>
                <span>{cue.text}</span>
              </button>
            ))
          : guide.chapters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`transcript-row ${item.id === chapter.id ? 'is-active' : ''}`}
                onClick={() => {
                  onSelect(item)
                  onClose()
                }}
              >
                <span className="transcript-row__time">{formatTime(item.start)}</span>
                <span>{item.short}</span>
                <PlayIcon size={8} />
              </button>
            ))}
      </div>
      <a
        className="button button--ghost transcript-link"
        href={youtubeWatchUrl(guide.youtubeId, chapter.start)}
        target="_blank"
        rel="noreferrer"
      >
        Open on YouTube <ArrowUpRightIcon size={13} />
      </a>
    </Dialog>
  )
}

function groupTranscript(cues: { start: number; text: string }[]): { start: number; text: string }[] {
  const groups: { start: number; text: string }[] = []
  let current: { start: number; text: string } | null = null
  for (const cue of cues) {
    if (!current) {
      current = { start: cue.start, text: cue.text }
      continue
    }
    const span = cue.start - current.start
    if (span >= 18 || current.text.length + cue.text.length > 340) {
      groups.push(current)
      current = { start: cue.start, text: cue.text }
    } else {
      current.text = `${current.text} ${cue.text}`
    }
  }
  if (current) groups.push(current)
  return groups
}
