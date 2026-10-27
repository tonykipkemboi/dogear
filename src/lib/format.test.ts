import { describe, expect, it } from 'vitest'
import {
  findQuote,
  formatTime,
  normalizeQuote,
  parseYouTubeUrl,
  youtubeEmbedUrl,
} from './format'

describe('parseYouTubeUrl', () => {
  it('accepts watch links, short links, shorts, embeds, and bare ids', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=hBzUokVYQkI')).toBe('hBzUokVYQkI')
    expect(parseYouTubeUrl('https://youtu.be/hBzUokVYQkI?t=42')).toBe('hBzUokVYQkI')
    expect(parseYouTubeUrl('https://youtube.com/shorts/hBzUokVYQkI')).toBe('hBzUokVYQkI')
    expect(parseYouTubeUrl('https://www.youtube-nocookie.com/embed/hBzUokVYQkI')).toBe('hBzUokVYQkI')
    expect(parseYouTubeUrl('hBzUokVYQkI')).toBe('hBzUokVYQkI')
  })

  it('rejects other links and malformed ids', () => {
    expect(parseYouTubeUrl('not a link')).toBeNull()
    expect(parseYouTubeUrl('https://example.com/watch?v=hBzUokVYQkI')).toBeNull()
    expect(parseYouTubeUrl('https://youtube.com/watch?v=short')).toBeNull()
    expect(parseYouTubeUrl('')).toBeNull()
  })
})

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(59)).toBe('0:59')
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(1484)).toBe('24:44')
    expect(formatTime(3059)).toBe('50:59')
    expect(formatTime(3600)).toBe('1:00:00')
  })
})

describe('findQuote', () => {
  it('finds a quote case-insensitively and preserves the source casing', () => {
    const result = findQuote(
      'The expensive part is that every new token forces the GPU to read the entire model out of memory. The KV cache is the trick that breaks the loop.',
      'the KV cache is the trick that breaks the loop',
    )
    expect(result?.match).toBe('The KV cache is the trick that breaks the loop')
    expect(result?.before).toContain('The expensive part')
  })

  it('normalizes whitespace before matching', () => {
    expect(findQuote('memory, not compute, sets the ceiling', 'memory,  not compute, sets the ceiling')?.match).toBe(
      'memory, not compute, sets the ceiling',
    )
  })

  it('returns null when the quote is absent', () => {
    expect(findQuote('A different sentence.', 'not here')).toBeNull()
    expect(findQuote('A different sentence.', '   ')).toBeNull()
  })
})

describe('normalizeQuote', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeQuote('  a   b\n c ')).toBe('a b c')
  })
})

describe('youtubeEmbedUrl', () => {
  it('sets a start time only when needed', () => {
    expect(youtubeEmbedUrl('hBzUokVYQkI')).toContain('autoplay=1')
    expect(youtubeEmbedUrl('hBzUokVYQkI')).not.toContain('start=')
    expect(youtubeEmbedUrl('hBzUokVYQkI', 1484)).toContain('start=1484')
  })
})
