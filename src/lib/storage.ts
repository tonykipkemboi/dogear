import type { Level, RecentHighlight } from '../data/guide'
import { DEFAULT_LEVEL } from '../data/guide'

const LEVEL_KEY = 'dogear.level'
const NOTES_KEY = 'dogear.notes'
const RECENT_KEY = 'dogear.recent-highlights'

export interface SavedNote {
  id: string
  quote: string
  chapterId: string
  chapterNumber: number
  sourceId?: string
  createdAt: string
}

export function readLevel(): Level {
  try {
    const value = localStorage.getItem(LEVEL_KEY)
    if (value === 'ELI5' || value === 'ELI15' || value === 'Undergrad' || value === 'Expert') return value
  } catch {
    // localStorage can be unavailable in private windows.
  }
  return DEFAULT_LEVEL
}

export function writeLevel(level: Level): void {
  try {
    localStorage.setItem(LEVEL_KEY, level)
  } catch {
    // Preferences are a convenience, not a requirement.
  }
}

export function readNotes(): SavedNote[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as SavedNote[]) : []
  } catch {
    return []
  }
}

export function addNote(note: Omit<SavedNote, 'id' | 'createdAt'>): SavedNote {
  const saved: SavedNote = {
    ...note,
    id: `note-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify([saved, ...readNotes()]))
  } catch {
    // Keep the in-memory result usable even if persistence fails.
  }
  return saved
}

export function clearNotes(): void {
  try {
    localStorage.removeItem(NOTES_KEY)
  } catch {
    // Nothing to do.
  }
}

export function readRecentHighlights(fallback: RecentHighlight[]): RecentHighlight[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentHighlight[]) : fallback
  } catch {
    // Fall back to the guide's editorial highlights.
  }
  return fallback
}

export function writeRecentHighlights(highlights: RecentHighlight[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(highlights.slice(0, 8)))
  } catch {
    // Recent highlights are optional.
  }
}

export function downloadNotes(notes: SavedNote[], guideTitle: string): void {
  const lines = [
    `# Notes from ${guideTitle}`,
    '',
    ...notes.flatMap((note) => [
      `## Chapter ${String(note.chapterNumber).padStart(2, '0')}`,
      '',
      `> ${note.quote}`,
      '',
    ]),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'dogear-notes.md'
  anchor.click()
  URL.revokeObjectURL(url)
}

export interface Prefs {
  model: string
  webSearch: boolean
}

const PREFS_KEY = 'dogear.prefs'
export const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017'

export function readPrefs(): Prefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>
    return {
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_MODEL,
      webSearch: typeof parsed.webSearch === 'boolean' ? parsed.webSearch : true,
    }
  } catch {
    return { model: DEFAULT_MODEL, webSearch: true }
  }
}

export function writePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Preferences are a convenience.
  }
}
