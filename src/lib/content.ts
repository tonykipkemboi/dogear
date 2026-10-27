import type { Chapter, HighlightAction, Level, Source } from '../data/guide'
import { getSource } from '../data/guide'

export interface HighlightContent {
  title: string
  body: string
  why?: string
  chips?: string[]
  source?: Source
  math?: string
}

const EXPLAIN: Record<Level, Omit<HighlightContent, 'chips'>> = {
  ELI5: {
    title: 'It keeps its notes.',
    body: 'Reading the whole prompt is the slow part. The cache is the model’s notes from that first read. It uses the notes instead of reading the prompt again.',
    why: 'That is why the first word can take a moment and the rest start to flow.',
    math: 'Each saved token keeps a key and a value, so the model does not have to make them again.',
  },
  ELI15: {
    title: "The model's scratch pad.",
    body: "Prefill reads the prompt and saves the work. Decode reuses it for every new token, so the model doesn't start over.",
    why: 'The cache is why the first token feels slow and the rest feel fast.',
    math: 'KV bytes ≈ 2 × layers × KV heads × head size × context × batch × precision.',
  },
  Undergrad: {
    title: 'A prefix KV cache.',
    body: 'The attention keys and values for the prompt are stored once. Decode attends to those cached tensors instead of recomputing them for each new token.',
    why: 'The saved work moves the bottleneck from arithmetic to memory reads.',
    math: 'Each decode step reads the weights and the cached K/V tensors. The arithmetic is small; the memory traffic is not.',
  },
  Expert: {
    title: 'Prefix reuse, bounded by memory.',
    body: 'The K/V tensors for a prefix are materialized once and reused across decode steps and requests with the same prefix. Capacity is the constraint; eviction is the policy problem.',
    why: 'Prefix caching turns cache residency into the scheduling primitive.',
    math: 'The cache is paged. A hit needs the exact token prefix, a free block, and a route to the worker that holds it.',
  },
}

export function getHighlightContent(
  action: HighlightAction,
  level: Level,
  _quote: string,
  sources?: Source[],
): HighlightContent {
  if (action === 'explain') {
    return {
      ...EXPLAIN[level],
      chips: level === 'ELI15' ? ['ELI5', 'ELI22', 'Show the math'] : ['ELI5', 'ELI15', 'Show the math'],
    }
  }

  if (action === 'simplify') {
    return {
      title: 'The short version.',
      body: 'The model reads your prompt once, writes down what it learned, and reuses those notes for every word it writes back.',
      why: 'The answer is the same. The second, third, and hundredth token are cheaper.',
      chips: ['ELI5', 'ELI15', 'Show the math'],
      math: 'One prompt read, many cached reads. That is the whole trade.',
    }
  }

  if (action === 'example') {
    return {
      title: 'A hundred tokens, one prompt.',
      body: 'Ask for a 100-word summary. Without a cache, the GPU re-reads the prompt 100 times. With the cache, it reads once and reuses the notes.',
      why: 'This is the difference between paying for the prompt once and paying for it on every token.',
      chips: ['ELI5', 'ELI15', 'Show the math'],
      math: 'Recompute 100 prefixes, or reuse one. The cache wins when memory is cheaper than repeating the work.',
    }
  }

  const source =
    sources?.find((item) => item.id === 'vllm-prefix') ?? sources?.[0] ?? getSource('vllm-prefix')
  return {
    title: source.title,
    body: source.extract[0],
    why: source.why,
    source,
  }
}

export function localAnswer(question: string, chapter: Chapter): string {
  const query = question.toLowerCase()
  if (query.includes('cache') || query.includes('kv')) {
    return 'The cache holds the keys and values for tokens the model has already read. Prefill fills it once, and decode reads from it instead of rebuilding the prompt for every new token.'
  }
  if (query.includes('prefill') || query.includes('decode')) {
    return 'Prefill reads the whole prompt in parallel and is compute-heavy. Decode writes one token at a time and is memory-heavy. Chapter 06 draws the split.'
  }
  if (query.includes('memory') || query.includes('gpu') || query.includes('vram')) {
    return 'Weights and cached tokens share GPU memory. When the cache fills, the server cannot add more concurrent work without evicting something or waiting.'
  }
  if (query.includes('batch')) {
    return 'Batching gives the GPU more work to do between tokens. It can raise throughput, but it also raises the time any one request waits.'
  }
  return `Chapter ${String(chapter.number).padStart(2, '0')} is about ${chapter.short.toLowerCase()}. The short version: ${chapter.deck}`
}
