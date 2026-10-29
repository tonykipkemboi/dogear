import { describe, expect, it } from 'vitest'
import { getHighlightContent, localAnswer } from './content'
import { SEEDED_GUIDE, getChapter, LEVELS, SOURCES } from '../data/guide'

describe('getHighlightContent', () => {
  it('changes the explanation with the level', () => {
    const kid = getHighlightContent('explain', 'ELI5', 'quote')
    const expert = getHighlightContent('explain', 'Expert', 'quote')
    expect(kid.title).toBe('“quote”')
    expect(expert.title).toBe('“quote”')
    expect(kid.body).not.toBe(expert.body)
  })

  it('returns an example and a source action', () => {
    expect(getHighlightContent('example', 'ELI15', 'quote').title).toBe('“quote”')
    const source = getHighlightContent('source', 'ELI15', 'q')
    expect(source.source?.id).toBe('vllm-prefix')
    expect(source.source?.verified).toBe(true)
  })

  it('uses the selected chapter instead of the KV-cache static copy', () => {
    const chapter = getChapter(SEEDED_GUIDE, 'llm-d')
    const simplified = getHighlightContent('simplify', 'ELI15', 'LLM-D', SOURCES, chapter)
    expect(simplified.title).toBe('“LLM-D”')
    expect(simplified.body).toContain('LLM-D')
    expect(simplified.body).not.toContain('scratch pad')
    expect(simplified.chips).not.toContain('Show the math')

    const source = getHighlightContent('source', 'ELI15', 'LLM-D', SOURCES, chapter)
    expect(source.source?.id).toBe('llm-d')

    const post = getHighlightContent('explain', 'ELI15', 'POST request', SOURCES, chapter)
    expect(post.body).toContain('HTTP request')
  })

  it('offers all four level labels in the chips', () => {
    for (const level of LEVELS) {
      const content = getHighlightContent('explain', level.id, 'quote')
      expect(content.chips).toContain('Show the math')
    }
  })
})

describe('localAnswer', () => {
  const chapter = getChapter(SEEDED_GUIDE, 'kv-cache')
  it('answers cache, prefill, memory, and batching questions from the chapter', () => {
    expect(localAnswer('What is the cache?', chapter)).toContain('keys and values')
    expect(localAnswer('Why is prefill different from decode?', chapter)).toContain('compute-heavy')
    expect(localAnswer('What fills GPU memory?', chapter)).toContain('GPU memory')
    expect(localAnswer('How does batching work?', chapter)).toContain('throughput')
  })

  it('falls back to the chapter summary', () => {
    expect(localAnswer('Tell me a joke', chapter)).toContain('Chapter 06')
  })
})
