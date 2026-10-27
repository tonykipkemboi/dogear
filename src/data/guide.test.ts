import { describe, expect, it } from 'vitest'
import { SEEDED_GUIDE, getChapter, getChapterByNumber, SOURCES } from './guide'

describe('seeded guide', () => {
  it('has ten chapters in timestamp order starting at chapter one', () => {
    expect(SEEDED_GUIDE.chapters).toHaveLength(10)
    expect(SEEDED_GUIDE.chapters[0].number).toBe(1)
    expect(SEEDED_GUIDE.chapters[9].number).toBe(10)
    for (let index = 1; index < SEEDED_GUIDE.chapters.length; index += 1) {
      expect(SEEDED_GUIDE.chapters[index].start).toBeGreaterThanOrEqual(
        SEEDED_GUIDE.chapters[index - 1].start,
      )
    }
  })

  it('keeps the chapter six article and its timestamps', () => {
    const chapter = getChapter(SEEDED_GUIDE, 'kv-cache')
    expect(chapter.title).toBe('The cache that makes chat feel instant.')
    expect(chapter.start).toBe(1484)
    expect(chapter.blocks.some((block) => block.type === 'diagram')).toBe(true)
    expect(getChapterByNumber(SEEDED_GUIDE, 6).id).toBe('kv-cache')
  })

  it('has curated sources with URLs and key points', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(3)
    for (const source of SOURCES) {
      expect(source.url.startsWith('https://')).toBe(true)
      expect(source.keyPoints.length).toBeGreaterThan(0)
      expect(source.verified).toBe(true)
    }
  })
})
