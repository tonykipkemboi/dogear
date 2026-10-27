import os from 'node:os'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_DIR = path.join(ROOT, 'data', 'library')

export function parseYouTubeId(value) {
  if (!value) return null
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return /^[A-Za-z0-9_-]{11}$/.test(id ?? '') ? id : null
    }
    if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v')
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    }
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function cleanLine(value) {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseVttTime(value) {
  const parts = value.replace(',', '.').split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

function parseVtt(raw) {
  const blocks = raw.replace(/\r/g, '').split(/\n{2,}/)
  const cues = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const timeLine = lines.find((line) => line.includes('-->'))
    if (!timeLine) continue
    const [rawStart, rawEnd] = timeLine.split('-->').map((part) => part.trim().split(' ')[0])
    const start = parseVttTime(rawStart)
    const end = parseVttTime(rawEnd)
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).map(cleanLine).filter(Boolean)
    const text = textLines[textLines.length - 1]
    if (!text || text.length < 2) continue
    if (cues.length && cues[cues.length - 1].text === text) continue
    if (cues.length && end - start < 0.05) continue
    cues.push({ start, end, text })
  }
  return cues
}

function paragraphsFromCues(cues) {
  const paragraphs = []
  let current = null
  for (const cue of cues) {
    if (!current) {
      current = { start: cue.start, text: cue.text }
      continue
    }
    const nextLength = current.text.length + cue.text.length + 1
    if (nextLength > 760 || cue.start - current.start > 34) {
      paragraphs.push(current)
      current = { start: cue.start, text: cue.text }
    } else {
      current.text = `${current.text} ${cue.text}`
    }
  }
  if (current) paragraphs.push(current)
  return paragraphs
    .map((paragraph) => ({
      ...paragraph,
      text: paragraph.text.replace(/\s+/g, ' ').trim(),
    }))
    .map((paragraph) => ({
      ...paragraph,
      text: /[.!?]$/.test(paragraph.text) ? paragraph.text : `${paragraph.text}.`,
    }))
}

export function buildTranscriptGuide({
  id,
  videoId,
  title,
  channel,
  duration,
  thumbnail,
  cues,
}) {
  const paragraphs = paragraphsFromCues(cues)
  if (paragraphs.length === 0) throw new Error('The transcript was empty.')
  const targetChapters = Math.max(4, Math.min(10, Math.round(duration / 300)))
  const perChapter = Math.max(1, Math.ceil(paragraphs.length / targetChapters))
  const chapters = []

  for (let index = 0; index < paragraphs.length; index += perChapter) {
    const slice = paragraphs.slice(index, index + perChapter)
    if (!slice.length) continue
    const start = slice[0].start
    const next = paragraphs[index + perChapter]
    const end = next ? next.start : duration
    const words = slice.reduce((total, paragraph) => total + paragraph.text.split(/\s+/).length, 0)
    chapters.push({
      id: `part-${chapters.length + 1}`,
      number: chapters.length + 1,
      title: `Part ${chapters.length + 1}`,
      short: `Part ${chapters.length + 1}`,
      deck: `${formatTime(start)} to ${formatTime(end)} · ${Math.max(1, Math.round(words / 220))} min read`,
      start,
      end,
      readMinutes: Math.max(1, Math.round(words / 220)),
      diagramCount: 0,
      keyPoints: [],
      blocks: slice.map((paragraph, paragraphIndex) => ({
        type: 'p',
        text: paragraph.text,
        ...(paragraphIndex === 0
          ? { timestamp: { label: 'source', seconds: Math.floor(paragraph.start) } }
          : {}),
      })),
    })
  }

  const wordCount = paragraphs.reduce((total, paragraph) => total + paragraph.text.split(/\s+/).length, 0)
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  return {
    id,
    title,
    channel: channel || 'YouTube',
    youtubeId: videoId,
    thumbnail,
    duration,
    chapterCount: chapters.length,
    readMinutes: Math.max(1, Math.round(wordCount / 220)),
    diagramCount: 0,
    webSourceCount: 1,
    progress: 0.08,
    minutesLeft: Math.max(1, Math.round(Math.max(1, Math.round(wordCount / 220)) * 0.92)),
    chapters,
    recentHighlights: [],
    sources: [
      {
        id: 'youtube-transcript',
        short: 'YouTube',
        title: title,
        domain: 'youtube.com',
        published: 'Live',
        readTime: 'Video',
        url: watchUrl,
        usedFor: 'The words in this guide come from the video transcript.',
        extract: [paragraphs[0].text],
        keyPoints: [],
        more: [{ title: 'Open on YouTube', href: watchUrl }],
        why: 'This guide is compiled directly from the video captions.',
        verified: true,
      },
    ],
    accent: '#E9FF4F',
  }
}

async function fetchMetadata(url) {
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['--skip-download', '--no-warnings', '--dump-single-json', url],
    { timeout: 90_000, maxBuffer: 24 * 1024 * 1024 },
  )
  const meta = JSON.parse(stdout)
  return {
    title: typeof meta.title === 'string' ? meta.title : 'Untitled video',
    channel: typeof meta.channel === 'string' ? meta.channel : typeof meta.uploader === 'string' ? meta.uploader : 'YouTube',
    duration: Number(meta.duration) || 0,
    thumbnail:
      typeof meta.thumbnail === 'string'
        ? meta.thumbnail
        : `https://i.ytimg.com/vi/${meta.id}/maxresdefault.jpg`,
    subtitles: meta.subtitles && typeof meta.subtitles === 'object' ? meta.subtitles : {},
    automatic_captions:
      meta.automatic_captions && typeof meta.automatic_captions === 'object'
        ? meta.automatic_captions
        : {},
  }
}

function findCaptionUrl(meta) {
  const groups = [
    meta.subtitles?.en,
    meta.subtitles?.['en-US'],
    meta.automatic_captions?.en,
    meta.automatic_captions?.['en-orig'],
  ]
  for (const tracks of groups) {
    if (!Array.isArray(tracks)) continue
    const track = tracks.find(
      (item) =>
        item?.ext === 'vtt' &&
        typeof item.url === 'string' &&
        !item.url.includes('manifest.googlevideo.com'),
    )
    if (track?.url) return track.url
  }
  return null
}

async function fetchDirectCaptions(meta) {
  const url = findCaptionUrl(meta)
  if (!url) return null
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) return null
    const text = await response.text()
    return text.includes('-->') ? text : null
  } catch {
    return null
  }
}

async function fetchCaptions(url, tempDir, meta) {
  const direct = await fetchDirectCaptions(meta)
  if (direct) return direct

  try {
    await execFileAsync(
      'yt-dlp',
      [
        '--skip-download',
        '--no-warnings',
        '--write-auto-subs',
        '--write-subs',
        '--sub-langs',
        'en',
        '--sub-format',
        'vtt',
        '-o',
        path.join(tempDir, '%(id)s.%(ext)s'),
        url,
      ],
      { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    )
  } catch (error) {
    const detail = String(error?.stderr || error?.message || '')
    if (detail.includes('429') || detail.toLowerCase().includes('too many requests')) {
      throw new Error('YouTube is rate-limiting caption requests. Wait a few minutes and retry.')
    }
    throw new Error('Could not fetch the English captions for this video. Try another video.')
  }
  const files = await readdir(tempDir)
  const vtt = files.find((file) => file.endsWith('.en.vtt')) ?? files.find((file) => file.endsWith('.vtt'))
  if (!vtt) throw new Error('No English captions were found for this video.')
  return readFile(path.join(tempDir, vtt), 'utf8')
}

export async function prepareYouTubeGuide(value) {
  const videoId = parseYouTubeId(value)
  if (!videoId) throw new Error('That is not a valid YouTube link.')
  const guideId = `yt-${videoId.toLowerCase()}`
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dogear-compile-'))
  try {
    const meta = await fetchMetadata(value)
    if (!meta.duration || meta.duration < 30) throw new Error('That video is too short to compile.')
    const raw = await fetchCaptions(value, tempDir, meta)
    const cues = parseVtt(raw)
    if (cues.length < 3) throw new Error('The captions did not contain enough text to compile.')
    return { videoId, guideId, meta, cues }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function compileYouTubeGuide(value) {
  const videoId = parseYouTubeId(value)
  if (!videoId) throw new Error('That is not a valid YouTube link.')
  const guideId = `yt-${videoId.toLowerCase()}`

  try {
    await stat(path.join(LIBRARY_DIR, `${guideId}.json`))
    return guideId
  } catch {
    // Not compiled yet.
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dogear-compile-'))
  try {
    const meta = await fetchMetadata(value)
    if (!meta.duration || meta.duration < 30) throw new Error('That video is too short to compile.')
    const raw = await fetchCaptions(value, tempDir, meta)
    const cues = parseVtt(raw)
    if (cues.length < 3) throw new Error('The captions did not contain enough text to compile.')
    const guide = buildTranscriptGuide({
      id: guideId,
      videoId,
      title: meta.title,
      channel: meta.channel,
      duration: meta.duration,
      thumbnail: meta.thumbnail,
      cues,
    })
    await mkdir(LIBRARY_DIR, { recursive: true })
    await writeFile(path.join(LIBRARY_DIR, `${guideId}.json`), `${JSON.stringify(guide, null, 2)}\n`, {
      mode: 0o600,
    })
    return guideId
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export { parseVtt, paragraphsFromCues }
