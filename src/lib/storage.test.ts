import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentHighlight } from '../data/guide'
import { readRecentHighlights, writeRecentHighlights } from './storage'

class MemoryStorage {
  private values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  clear() {
    this.values.clear()
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }
}

const a: RecentHighlight = { id: 'a', quote: 'quote a', chapterId: 'one', seconds: 1 }
const b: RecentHighlight = { id: 'b', quote: 'quote b', chapterId: 'two', seconds: 2 }

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

describe('recent highlights', () => {
  it('keeps recent highlights isolated per guide', () => {
    writeRecentHighlights([a], 'guide-a')
    writeRecentHighlights([b], 'guide-b')
    expect(readRecentHighlights([], 'guide-a')).toEqual([a])
    expect(readRecentHighlights([], 'guide-b')).toEqual([b])
  })

  it('does not bring the editorial highlights back after the user deletes them all', () => {
    writeRecentHighlights([a], 'guide-a')
    writeRecentHighlights([], 'guide-a')
    expect(readRecentHighlights([a], 'guide-a')).toEqual([])
  })

  it('uses the guide fallback only when nothing has been saved for that guide', () => {
    expect(readRecentHighlights([a], 'fresh-guide')).toEqual([a])
  })
})
