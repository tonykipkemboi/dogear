import { describe, expect, it } from 'vitest'
import { EXAMPLE_GUIDE, SEEDED_GUIDE, getChapter, getChapterByNumber, SOURCES } from './guide'

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

  it('keeps the chapter six article and its video frames', () => {
    const chapter = getChapter(SEEDED_GUIDE, 'kv-cache')
    expect(chapter.title).toBe('The cache that makes chat feel instant.')
    expect(chapter.start).toBe(1484)
    expect(chapter.blocks.filter((block) => block.type === 'frame')).toHaveLength(2)
    expect(chapter.blocks.every((block) => block.type !== 'frame' || block.src.startsWith('/frames/'))).toBe(true)
    expect(getChapterByNumber(SEEDED_GUIDE, 6).id).toBe('kv-cache')
  })

  it('gives every chapter at least one real video frame', () => {
    for (const chapter of SEEDED_GUIDE.chapters) {
      const frames = chapter.blocks.filter((block) => block.type === 'frame')
      expect(frames.length).toBeGreaterThanOrEqual(1)
      for (const frame of frames) {
        expect(frame.timestamp.seconds).toBeGreaterThan(0)
        expect(frame.src.startsWith('/frames/')).toBe(true)
      }
    }
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

describe('compiled example guide', () => {
  it('ships a complete eight-chapter guide with diagrams and recall checks', () => {
    expect(EXAMPLE_GUIDE.chapters).toHaveLength(8)
    expect(EXAMPLE_GUIDE.diagramCount).toBe(8)
    expect(EXAMPLE_GUIDE.transcript?.length).toBeGreaterThan(1_000)
    expect(EXAMPLE_GUIDE.thumbnail).toBe('/example-modern-ai.jpg')
    expect(
      EXAMPLE_GUIDE.chapters.some((chapter) =>
        chapter.blocks.some((block) => block.type === 'diagram' && block.kind === 'loop'),
      ),
    ).toBe(true)
    for (const chapter of EXAMPLE_GUIDE.chapters) {
      expect(chapter.title).not.toMatch(/^Chapter \d+$/)
      expect(chapter.blocks.some((block) => block.type === 'p')).toBe(true)
      expect(chapter.blocks.some((block) => block.type === 'diagram')).toBe(true)
      expect(chapter.blocks.some((block) => block.type === 'recall')).toBe(true)
    }
  })
})
