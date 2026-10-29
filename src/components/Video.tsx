import { useEffect, useRef, useState } from 'react'
import type { Chapter, Guide } from '../data/guide'
import { Dialog } from './Dialog'
import { ArrowUpRightIcon, CloseIcon, ExpandIcon, PlayIcon } from './Icons'
import { YouTubeMark } from './Marks'
import { formatTime, youtubeEmbedUrl, youtubeWatchUrl } from '../lib/format'
import { loadYouTubeApi, setYouTubeCaptions, type YouTubePlayer } from '../lib/youtube'

export function VideoPlayer({
  guide,
  chapter,
  inlineStart,
  onPlay,
  onClose,
  onExpand,
  playbackRate,
  captions,
  onPlayerReady,
}: {
  guide: Guide
  chapter: Chapter
  inlineStart: number | null
  onPlay: (seconds: number) => void
  onClose: () => void
  onExpand: (seconds: number) => void
  playbackRate: number
  captions: boolean
  onPlayerReady: (player: YouTubePlayer | null) => void
}) {
  const progress = Math.min(100, (chapter.start / guide.duration) * 100)

  return (
    <div className="video-player">
      {inlineStart !== null ? (
        <InlineVideo
          guide={guide}
          start={inlineStart}
          onClose={onClose}
          onExpand={() => onExpand(inlineStart)}
          playbackRate={playbackRate}
          captions={captions}
          onPlayerReady={onPlayerReady}
        />
      ) : (
        <div className="video-player__poster">
          <img src={guide.thumbnail} alt="" className="video-player__image" />
          <span className="video-player__shade" aria-hidden="true" />
          <button
            type="button"
            className="video-player__hit"
            onClick={() => onPlay(chapter.start)}
            aria-label={`Play ${guide.title} at ${formatTime(chapter.start)} in place`}
          />
          <span className="video-player__play" aria-hidden="true">
            <PlayIcon size={18} />
          </span>
          <span className="video-player__bottom">
            <span className="video-player__progress" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </span>
            <span className="video-player__bottom-row">
              <span className="video-player__time">
                {formatTime(chapter.start)} <span>/ {formatTime(guide.duration)}</span>
              </span>
            </span>
          </span>
          <button
            type="button"
            className="video-player__expand-button"
            onClick={() => onExpand(chapter.start)}
            aria-label="Expand video"
          >
            Expand <ExpandIcon size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

export function InlineVideo({
  guide,
  start,
  onClose,
  onExpand,
  playbackRate,
  captions,
  onPlayerReady,
}: {
  guide: Guide
  start: number
  onClose: () => void
  onExpand: () => void
  playbackRate: number
  captions: boolean
  onPlayerReady: (player: YouTubePlayer | null) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)
  const readyRef = useRef(onPlayerReady)
  readyRef.current = onPlayerReady

  useEffect(() => {
    let cancelled = false
    let created: YouTubePlayer | null = null

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        created = new YT.Player(hostRef.current, {
          videoId: guide.youtubeId,
          playerVars: {
            autoplay: 1,
            start: Math.floor(start),
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (cancelled || !created) return
              setPlayer(created)
              readyRef.current(created)
              created.setPlaybackRate(playbackRate)
              if (captions) setYouTubeCaptions(created, true)
            },
          },
        })
      })
      .catch(() => {
        // The poster/overlay remains usable if the Iframe API is unavailable.
      })

    return () => {
      cancelled = true
      setPlayer(null)
      readyRef.current(null)
      try {
        created?.destroy()
      } catch {
        // The iframe may already be gone.
      }
    }
    // The player is recreated only when the video or start time changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.youtubeId, start])

  useEffect(() => {
    if (!player) return
    player.setPlaybackRate(playbackRate)
  }, [player, playbackRate])

  useEffect(() => {
    if (!player) return
    setYouTubeCaptions(player, captions)
  }, [player, captions])

  return (
    <div className="video-inline">
      <div className="video-inline__player" ref={hostRef} />
      <div className="video-inline__actions">
        <button type="button" onClick={onExpand} aria-label="Expand video">
          <ExpandIcon size={11} /> Expand
        </button>
        <button type="button" onClick={onClose} aria-label="Close video" className="video-inline__close">
          <CloseIcon size={13} />
        </button>
      </div>
    </div>
  )
}

export function MiniPlayer({
  guide,
  chapter,
  onPlay,
  onExpand,
}: {
  guide: Guide
  chapter: Chapter
  onPlay: (seconds: number) => void
  onExpand: (seconds: number) => void
}) {
  return (
    <div className="mini-player">
      <button type="button" className="mini-player__main" onClick={() => onPlay(chapter.start)}>
        <span className="mini-player__thumb">
          <img src={guide.thumbnail} alt="" />
          <span className="mini-player__play">
            <PlayIcon size={7} />
          </span>
        </span>
        <span className="mini-player__copy">
          <span className="mini-player__title">{guide.title}</span>
          <span className="mini-player__chapter">
            {String(chapter.number).padStart(2, '0')} · {chapter.short}
          </span>
        </span>
        <span className="mini-player__time">{formatTime(chapter.start)}</span>
      </button>
      <button
        type="button"
        className="mini-player__expand"
        onClick={() => onExpand(chapter.start)}
        aria-label="Expand video"
      >
        <ExpandIcon size={11} />
      </button>
    </div>
  )
}

export function VideoDialog({
  guide,
  open,
  start,
  onClose,
}: {
  guide: Guide
  open: boolean
  start: number
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} className="video-dialog" labelledBy="video-title">
      <div className="video-dialog__head">
        <div>
          <span className="mono-label">Now playing</span>
          <h2 id="video-title">{guide.title}</h2>
        </div>
        <div className="video-dialog__actions">
          <a
            className="icon-button"
            href={youtubeWatchUrl(guide.youtubeId, start)}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on YouTube"
          >
            <ArrowUpRightIcon size={17} />
          </a>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close video">
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
      <div className="video-dialog__frame">
        <iframe
          key={`${guide.youtubeId}-${start}`}
          src={youtubeEmbedUrl(guide.youtubeId, start)}
          title={guide.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="video-dialog__meta">
        <YouTubeMark size={20} />
        <span>
          {String(guide.chapterCount).padStart(2, '0')} chapters · {formatTime(guide.duration)} ·{' '}
          {guide.channel}
        </span>
        <span className="video-dialog__meta-right">Start {formatTime(start)}</span>
      </div>
    </Dialog>
  )
}

export function PlaybackDock({
  guide,
  chapter,
  onPlay,
  onTranscript,
  onNotes,
  playbackRate,
  captions,
  onRateChange,
  onToggleCaptions,
}: {
  guide: Guide
  chapter: Chapter
  onPlay: (seconds: number) => void
  onTranscript: () => void
  onNotes: () => void
  playbackRate: number
  captions: boolean
  onRateChange: (rate: number) => void
  onToggleCaptions: () => void
}) {
  const progress = Math.min(100, (chapter.start / guide.duration) * 100)

  return (
    <div className="playback-dock">
      <button
        type="button"
        className="playback-dock__play"
        onClick={() => onPlay(chapter.start)}
        aria-label={`Play from ${formatTime(chapter.start)} in place`}
      >
        <PlayIcon size={13} />
      </button>
      <span className="playback-dock__chapter">
        Chapter {String(chapter.number).padStart(2, '0')} · {chapter.short}
      </span>
      <span className="playback-dock__track" aria-hidden="true">
        <span style={{ width: `${Math.max(12, progress)}%` }} />
        <span className="playback-dock__thumb" style={{ left: `${Math.max(12, progress)}%` }} />
      </span>
      <span className="playback-dock__time">
        {formatTime(chapter.start)} <span>/ {formatTime(guide.duration)}</span>
      </span>
      <button
        type="button"
        className="playback-dock__control"
        onClick={() => onRateChange(playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 2 : 1)}
        aria-label={`Playback speed ${playbackRate} times`}
      >
        {playbackRate}×
      </button>
      <button
        type="button"
        className={`playback-dock__control ${captions ? 'is-active' : ''}`}
        aria-pressed={captions}
        onClick={onToggleCaptions}
      >
        CC
      </button>
      <button type="button" className="playback-dock__control" onClick={onTranscript}>
        Transcript
      </button>
      <button type="button" className="playback-dock__control" onClick={onNotes}>
        Notes
      </button>
    </div>
  )
}
