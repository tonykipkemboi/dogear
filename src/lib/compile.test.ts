import { describe, expect, it } from 'vitest'
// @ts-ignore -- the compiler is plain ESM so the server and tests share one parser.
import { buildTranscriptGuide, parseVtt } from '../../server/compile.mjs'

const SAMPLE = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:03.000 align:start position:0%
Hello <c>world</c>

00:00:03.000 --> 00:00:05.000
This is the second cue.

00:00:05.000 --> 00:00:08.000
A third sentence arrives here.

00:00:08.000 --> 00:00:12.000
And the fourth sentence closes the sample.

00:00:12.000 --> 00:00:16.000
One more sentence for the guide.
`

describe('transcript compiler', () => {
  it('parses VTT cues and strips inline timing tags', () => {
    const cues = parseVtt(SAMPLE)
    expect(cues).toHaveLength(5)
    expect(cues[0].text).toBe('Hello world')
    expect(cues[1].start).toBe(3)
  })

  it('builds a readable guide with chapters and a source', () => {
    const cues = parseVtt(SAMPLE)
    const guide = buildTranscriptGuide({
      id: 'yt-test',
      videoId: 'abcdefghijk',
      title: 'A test video',
      channel: 'Test channel',
      duration: 16,
      thumbnail: 'https://example.com/thumb.jpg',
      cues,
    })
    expect(guide.title).toBe('A test video')
    expect(guide.chapterCount).toBe(guide.chapters.length)
    expect(guide.chapters.length).toBeGreaterThan(0)
    expect(guide.chapters[0].blocks.length).toBeGreaterThan(0)
    expect(guide.sources[0].url).toContain('watch?v=abcdefghijk')
    expect(guide.youtubeId).toBe('abcdefghijk')
  })
})
