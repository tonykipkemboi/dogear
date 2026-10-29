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

function quoteTitle(quote: string): string {
  const clean = quote.replace(/\s+/g, ' ').trim()
  const short = clean.length > 64 ? `${clean.slice(0, 64).trimEnd()}…` : clean
  return `“${short}”`
}

interface Term {
  term: string
  definition: string
  simple: string
  kid: string
  example: string
  why: string
}

const TERMS: Term[] = [
  {
    term: 'LLM-D',
    definition:
      'LLM-D is an open-source distributed inference system for serving large language models across multiple workers. It separates prefill and decode into different pools and routes requests with cache locality in mind.',
    simple:
      'LLM-D is a way to run a large language model across several machines so more people can use it. It keeps the cached prompt close to the worker that needs it.',
    kid:
      'A bunch of computers share one big job, like friends carrying a heavy box together.',
    example:
      'One pool reads a long prompt and builds the KV cache. Another pool writes the answer. The router sends the request to the worker that already has the matching cache.',
    why: 'The system around the model becomes a routing and memory problem, not just a model problem.',
  },
  {
    term: 'POST request',
    definition:
      'A POST request is an HTTP request that sends data to a server. In this chapter, the dashboard sends a POST request to the vLLM server to pull live inference metrics.',
    simple:
      'A POST request is a message an app sends to a server to ask it to do something or return fresh data.',
    kid:
      'A note your app sends to ask a computer for something.',
    example:
      'The dashboard sends a POST request to the vLLM server, receives the current token throughput, and places that number beside the benchmark comparison.',
    why: 'It turns the dashboard from a static report into a live operational signal.',
  },
  {
    term: 'RAG',
    definition:
      'Retrieval augmented generation looks up relevant passages from a knowledge source, then gives those passages to a language model alongside the question.',
    simple:
      'RAG is a way to give a model an open-book lookup before it answers, instead of relying only on what it memorized during training.',
    kid:
      'The answer helper looks something up in a book before it answers.',
    example:
      'A question is turned into a search query, relevant PDF chunks are retrieved, and the model answers from those chunks rather than from memory alone.',
    why: 'It lets the model answer over fresh or private material it was not trained on.',
  },
  {
    term: 'KV cache',
    definition:
      'The KV cache stores the attention keys and values for tokens the model has already processed, so decode can reuse them instead of rebuilding the prompt for each new token.',
    simple:
      'The KV cache is the model’s notes from reading a prompt once. It reuses those notes for each new word.',
    kid:
      'The answer helper writes down what it read so it does not have to read it again.',
    example:
      'Prefill reads a long prompt and saves its keys and values. Decode reads that cache instead of re-reading the whole prompt for the next token.',
    why: 'It moves the serving bottleneck from repeated computation to memory capacity.',
  },
  {
    term: 'prefill',
    definition:
      'Prefill processes the prompt in parallel and builds the KV cache. It is compute-heavy and happens once per prompt.',
    simple: 'Prefill is the model reading the whole prompt before it starts writing.',
    kid:
      'The helper reads your whole question before it starts to answer.',
    example: 'A long document is read in one parallel pass, then its cached state is ready for the first generated token.',
    why: 'It explains the pause before a chat response starts streaming.',
  },
  {
    term: 'decode',
    definition:
      'Decode generates one token per forward pass and reuses the KV cache. It is memory-bandwidth-bound rather than compute-bound.',
    simple: 'Decode writes one word at a time, using the notes the model already saved.',
    kid:
      'The helper writes the answer one word at a time.',
    example: 'The model writes token after token, reading the cached keys and values for the tokens already produced.',
    why: 'It explains why the steady stream of a response is limited by memory traffic.',
  },
  {
    term: 'vLLM',
    definition:
      'vLLM is a serving engine for large language models. It schedules requests and uses paged KV cache management to share and reclaim GPU memory.',
    simple: 'vLLM is the traffic controller between many requests and the GPU.',
    kid:
      'A traffic cop that sends many questions to the computers.',
    example: 'It packs multiple conversations into a batch, pages their KV caches, and reclaims memory when a request finishes.',
    why: 'It is where batching, latency, and memory policy meet.',
  },
  {
    term: 'batching',
    definition:
      'Batching puts multiple requests through the GPU together so it has more work to do between token steps. It can improve throughput while increasing the wait for any one request.',
    simple: 'Batching lets the GPU serve several people at once instead of waiting on one conversation.',
    kid:
      'Doing several chores in one trip instead of one at a time.',
    example: 'Four users ask questions at the same time; their decode steps are grouped into one larger GPU pass.',
    why: 'It is a throughput lever, not a latency cure.',
  },
  {
    term: 'sharding',
    definition:
      'Sharding splits a model that does not fit on one GPU across multiple devices. Tensor parallelism splits the math in a layer; pipeline parallelism splits layers into stages.',
    simple: 'Sharding breaks a giant model into pieces so several GPUs can hold it.',
    kid:
      'Cutting a giant puzzle into pieces so several tables can hold it.',
    example: 'One layer’s matrix is split across four GPUs, and each device computes its slice before the results are combined.',
    why: 'It makes a large model fit, but adds communication cost.',
  },
  {
    term: 'prefix cache',
    definition:
      'A prefix cache reuses the KV cache for an exact prompt prefix. A cache hit skips prefill for that shared prefix; a changed opening text causes a miss.',
    simple: 'A prefix cache remembers the start of a prompt so the model does not read it again.',
    kid:
      'Remembering the start of a story so you do not have to reread it.',
    example: 'Two requests share the same system prompt. The second one reuses the cached prefix and prefills only its new question.',
    why: 'It makes shared context cheaper, but routing has to preserve locality.',
  },
]

function findTerm(quote: string): Term | null {
  const normalized = quote.toLowerCase().replace(/[“”"]/g, '').trim()
  if (!normalized || normalized.split(/\s+/).length > 4) return null
  return TERMS.find((item) => normalized === item.term.toLowerCase()) ?? null
}

const EXPLAIN: Record<Level, Omit<HighlightContent, 'chips'>> = {
  ELI5: {
    title: 'It remembers the question.',
    body: 'A helper reads your whole question once and keeps a little note. Later, it uses the note instead of reading the question again. That saves time.',
    why: 'The first word can feel slow because the helper is reading. The next words come faster because it already has the note.',
  },
  ELI15: {
    title: "The helper's notes.",
    body: 'The helper reads your whole question once and saves the important notes. Then it uses those notes for each new word instead of rereading the whole question. That is why the first word is slower than the rest.',
    why: 'The first word is slow because the helper is reading. Later words come faster because it reuses the notes.',
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
  chapter?: Chapter,
): HighlightContent {
  const term = action !== 'source' ? findTerm(_quote) : null
  if (term) {
    return {
      title: quoteTitle(_quote),
      body:
        action === 'example'
          ? term.example
          : level === 'ELI5'
            ? term.kid
            : action === 'simplify' || level === 'ELI15'
              ? term.simple
              : term.definition,
      why: level === 'ELI5' ? undefined : term.why || chapter?.keyPoints[0],
      chips: ['ELI5', 'ELI15'],
    }
  }

  if (action !== 'source' && chapter && chapter.id !== 'kv-cache') {
    const points = chapter.keyPoints
    const focus = chapter.blocks.find(
      (block) => block.type === 'p' && block.text.toLowerCase().includes(_quote.toLowerCase()),
    )
    const focusText = focus && focus.type === 'p' ? focus.text : ''
    if (action === 'explain') {
      return {
        title: quoteTitle(_quote),
        body: `${chapter.deck}${focusText ? ` ${focusText}` : ` ${points.join(' ')}`}`,
        why: level === 'ELI5' || level === 'ELI15' ? undefined : points[1] ?? points[0],
        chips: ['ELI5', 'ELI15'],
      }
    }
    if (action === 'simplify') {
      return {
        title: quoteTitle(_quote),
        body: `${chapter.deck} ${points[0]}`,
        why: level === 'ELI5' || level === 'ELI15' ? undefined : points[1] ?? points[0],
        chips: ['ELI5', 'ELI15'],
      }
    }
    return {
      title: quoteTitle(_quote),
      body: `Here is the idea in one request. ${points[0]} ${points[1] ?? ''}`.trim(),
      why: level === 'ELI5' || level === 'ELI15' ? undefined : points[2] ?? points[0],
      chips: ['ELI5', 'ELI15'],
    }
  }

  if (action === 'explain') {
    return {
      ...EXPLAIN[level],
      title: quoteTitle(_quote),
      chips:
        level === 'ELI5'
          ? ['ELI5', 'ELI15']
          : level === 'ELI15'
            ? ['ELI5', 'ELI22', 'Show the math']
            : ['ELI5', 'ELI15', 'Show the math'],
    }
  }

  if (action === 'simplify') {
    return {
      title: quoteTitle(_quote),
      body: 'The model reads your prompt once, writes down what it learned, and reuses those notes for every word it writes back.',
      why: 'The answer is the same. The second, third, and hundredth token are cheaper.',
      chips: ['ELI5', 'ELI15', 'Show the math'],
      math: 'One prompt read, many cached reads. That is the whole trade.',
    }
  }

  if (action === 'example') {
    return {
      title: quoteTitle(_quote),
      body: 'Ask for a 100-word summary. Without a cache, the GPU re-reads the prompt 100 times. With the cache, it reads once and reuses the notes.',
      why: 'This is the difference between paying for the prompt once and paying for it on every token.',
      chips: ['ELI5', 'ELI15', 'Show the math'],
      math: 'Recompute 100 prefixes, or reuse one. The cache wins when memory is cheaper than repeating the work.',
    }
  }

  const preferredSource =
    chapter && chapter.number >= 8
      ? 'llm-d'
      : chapter && chapter.number >= 2 && chapter.number <= 3
        ? 'nvidia-h200'
        : 'vllm-prefix'
  const source =
    sources?.find((item) => item.id === preferredSource) ??
    sources?.find((item) => item.id === 'vllm-prefix') ??
    sources?.[0] ??
    getSource('vllm-prefix')
  return {
    title: quoteTitle(_quote),
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
