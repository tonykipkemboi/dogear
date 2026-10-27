export type Level = 'ELI5' | 'ELI15' | 'Undergrad' | 'Expert'
export type HighlightAction = 'explain' | 'simplify' | 'example' | 'source'

export type Block =
  | {
      type: 'p'
      text: string
      timestamp?: { label: string; seconds: number }
      quote?: string
    }
  | {
      type: 'h2'
      text: string
      kicker?: string
      timestamp?: { label: string; seconds: number }
    }
  | { type: 'diagram'; variant: 'prefill-decode' }
  | { type: 'caption'; text: string; timestamp?: { label: string; seconds: number } }
  | { type: 'callout'; label: string; text: string }

export interface Chapter {
  id: string
  number: number
  title: string
  short: string
  deck: string
  start: number
  end: number
  readMinutes: number
  diagramCount: number
  blocks: Block[]
  keyPoints: string[]
}

export interface Source {
  id: string
  short: string
  title: string
  domain: string
  published: string
  readTime: string
  url: string
  extract: string[]
  keyPoints: string[]
  more: { title: string; href: string }[]
  why: string
  usedFor: string
  verified: boolean
}

export interface RecentHighlight {
  id: string
  quote: string
  chapterId: string
  seconds: number
}

export interface Guide {
  id: string
  title: string
  channel: string
  youtubeId: string
  thumbnail: string
  duration: number
  chapterCount: number
  readMinutes: number
  diagramCount: number
  webSourceCount: number
  progress: number
  minutesLeft?: number
  chapters: Chapter[]
  recentHighlights: RecentHighlight[]
  sources: Source[]
  accent: string
}

export const LEVELS: { id: Level; label: string; short: string }[] = [
  { id: 'ELI5', label: 'ELI5', short: 'Kid' },
  { id: 'ELI15', label: 'ELI15', short: 'Curious' },
  { id: 'Undergrad', label: 'Undergrad', short: 'Technical' },
  { id: 'Expert', label: 'Expert', short: 'Deep' },
]

export const DEFAULT_LEVEL: Level = 'ELI15'

export const SOURCES: Source[] = [
  {
    id: 'vllm-prefix',
    short: 'vLLM docs',
    title: 'Prefix caching',
    domain: 'docs.vllm.ai',
    published: 'Aug 2026',
    readTime: '7 min read',
    url: 'https://docs.vllm.ai/en/latest/features/prefix_caching.html',
    usedFor: 'The KV cache lives in GPU memory.',
    extract: [
      'vLLM keeps the KV cache blocks for a prompt and reuses them when the same prefix appears again. A cache hit skips prefill for that part of the prompt, which is why a follow-up turn can start faster.',
      'The cache is keyed by the exact prefix. If the opening text changes, the cache misses and prefill runs again.',
    ],
    keyPoints: [
      'Blocks are reused across requests.',
      'Prefix hits skip prefill.',
      'The cache is bounded by GPU memory.',
    ],
    more: [
      { title: 'Automatic prefix caching', href: 'https://docs.vllm.ai/en/latest/features/prefix_caching.html' },
      { title: 'Cache eviction', href: 'https://docs.vllm.ai/en/latest/features/prefix_caching.html' },
      { title: 'Scheduling & memory', href: 'https://docs.vllm.ai/en/latest/features/prefix_caching.html' },
    ],
    why: 'Selected because it defines prefix caching and the memory limit in the same section.',
    verified: true,
  },
  {
    id: 'hf-kv',
    short: 'Hugging Face',
    title: 'KV cache',
    domain: 'huggingface.co',
    published: 'Mar 2026',
    readTime: '11 min read',
    url: 'https://huggingface.co/docs/transformers/en/kv_cache',
    usedFor: 'The mechanism is a saved attention state.',
    extract: [
      'During generation, each new token attends to the tokens before it. The key and value tensors for those earlier tokens do not change, so a model can store them instead of rebuilding them at every step.',
      'The cache grows with context length and batch size. That growth is the main reason long-context serving is memory constrained.',
    ],
    keyPoints: [
      'Keys and values are stored per layer.',
      'The cache grows with context and batch size.',
      'Longer answers cost more memory, not only more compute.',
    ],
    more: [
      { title: 'Caching strategies', href: 'https://huggingface.co/docs/transformers/en/kv_cache' },
      { title: 'Memory and long context', href: 'https://huggingface.co/docs/transformers/en/kv_cache' },
    ],
    why: 'Chosen for its plain description of what is actually stored, which matches the diagram in chapter 06.',
    verified: true,
  },
  {
    id: 'nvidia-h200',
    short: 'NVIDIA',
    title: 'H200 Tensor Core GPU',
    domain: 'nvidia.com',
    published: '2025',
    readTime: '4 min read',
    url: 'https://www.nvidia.com/en-us/data-center/h200/',
    usedFor: 'H200 has 141GB of HBM.',
    extract: [
      'The H200 Tensor Core GPU pairs a large HBM3e memory pool with high memory bandwidth. The extra capacity changes what fits on a single device, including larger model weights and longer key-value caches.',
      'Memory capacity and bandwidth both matter for inference: one sets what can be held, the other sets how quickly it can be read.',
    ],
    keyPoints: [
      '141GB of HBM3e memory.',
      'Higher bandwidth helps memory-bound decode.',
      'Capacity and bandwidth are different constraints.',
    ],
    more: [{ title: 'H200 specifications', href: 'https://www.nvidia.com/en-us/data-center/h200/' }],
    why: 'Included to verify the memory number used in the chapter, not to make a hardware recommendation.',
    verified: true,
  },
]

const chapterSix: Chapter = {
  id: 'kv-cache',
  number: 6,
  title: 'The cache that makes chat feel instant.',
  short: 'KV cache',
  deck: 'You pay for the pause once. Then the model remembers.',
  start: 1484,
  end: 1710,
  readMinutes: 6,
  diagramCount: 3,
  keyPoints: [
    'Prefill runs once over the prompt.',
    'Decode reuses the saved keys and values.',
    'Memory, not compute, sets the serving ceiling.',
  ],
  blocks: [
    {
      type: 'p',
      text: "A language model has exactly one trick: given all the text so far, predict the next token. Then it appends that token to the input and runs the whole model again. A 100-token answer isn't one big calculation. It's the same loop, a hundred times.",
    },
    {
      type: 'p',
      text: 'The expensive part is that every new token forces the GPU to read the entire model out of memory. The KV cache is the trick that breaks the loop: prefill saves its work in GPU memory, so decode reuses it instead of re-reading the prompt. You pay for the pause once.',
      timestamp: { label: 'prefill ends', seconds: 1513 },
      quote: 'The KV cache is the trick that breaks the loop',
    },
    {
      type: 'p',
      text: "That saved work is why chat feels instant even when the model is enormous. It's also why memory, not compute, sets the ceiling on how many people one GPU can serve.",
      quote: 'memory, not compute, sets the ceiling',
    },
    {
      type: 'h2',
      text: 'Prefill is a burst. Decode is a grind.',
      kicker: '06.1 · THE TWO PHASES',
      timestamp: { label: '24:44', seconds: 1484 },
    },
    {
      type: 'p',
      text: "Prefill reads the whole prompt in one pass, using the GPU's math. Decode writes one token at a time and re-reads the model from memory for each one.",
    },
    { type: 'diagram', variant: 'prefill-decode' },
    {
      type: 'caption',
      text: "Fig. 06. The same GPU takes turns doing two different jobs. That's the whole reason batching and disaggregation exist.",
      timestamp: { label: '24:44', seconds: 1484 },
    },
    {
      type: 'callout',
      label: 'What to remember',
      text: 'Prefill is compute-heavy and happens once. Decode is memory-heavy and happens once per token. The KV cache is the bridge between them.',
    },
  ],
}

const otherChapters: Chapter[] = [
  {
    id: 'what-a-model-is',
    number: 1,
    title: 'A model is a next-token machine.',
    short: 'What a model is',
    deck: 'It does not look up an answer. It predicts one token, then another.',
    start: 125,
    end: 423,
    readMinutes: 4,
    diagramCount: 1,
    keyPoints: [
      'A model predicts the next token, not a whole answer.',
      'Each new token is appended to the context.',
      'The loop repeats until the model stops.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'A language model is a function that takes a sequence of tokens and returns a probability for every token that could come next. Pick one, append it, run the function again.',
      },
      {
        type: 'p',
        text: 'That is the whole generation loop. A short answer is many passes, not one. The model has no separate plan sitting in memory unless the interface asks it to write one down.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'The unit of work is one token. Everything expensive in serving comes from doing that work repeatedly and keeping the context available.',
      },
    ],
  },
  {
    id: 'cpu-vs-gpu',
    number: 2,
    title: 'A GPU is a room full of small calculators.',
    short: 'CPU vs GPU',
    deck: 'CPUs are few and flexible. GPUs are many and narrow. Matrix math loves many.',
    start: 424,
    end: 674,
    readMinutes: 4,
    diagramCount: 2,
    keyPoints: [
      'A CPU is built for branching and latency.',
      'A GPU is built for parallel arithmetic.',
      'Transformer math is mostly matrix multiplication.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'A CPU has a handful of powerful cores that can follow complicated instructions. A GPU has thousands of simpler lanes that want to do the same operation at once.',
      },
      {
        type: 'p',
        text: 'Matrix multiplication is the same multiply-and-add repeated across a grid. That shape is a better fit for a GPU, which is why a model that feels impossible on a laptop can run on a server.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'The GPU is not magic. It is a different trade: less flexibility, much more parallel arithmetic.',
      },
    ],
  },
  {
    id: 'vram',
    number: 3,
    title: 'VRAM is the real budget.',
    short: 'VRAM & three numbers',
    deck: 'Weights, KV cache, and activations all live in the same memory.',
    start: 675,
    end: 930,
    readMinutes: 5,
    diagramCount: 2,
    keyPoints: [
      'Weights take memory before anyone sends a prompt.',
      'The KV cache grows with context and concurrency.',
      'Capacity and bandwidth are separate limits.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'Before a model answers anything, its weights have to fit in GPU memory. Then each active conversation needs room for its growing KV cache. The leftovers are where the batch lives.',
      },
      {
        type: 'p',
        text: 'There are three numbers worth keeping separate: how many parameters the model has, how much memory each cached token costs, and how much room is left for people. The third number is usually the one that decides throughput.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'A GPU can have plenty of compute left and still refuse more work because memory is full. Serving is a memory allocation problem as much as a math problem.',
      },
    ],
  },
  {
    id: 'vllm',
    number: 4,
    title: 'vLLM is the scheduler between you and the GPU.',
    short: 'The vLLM server',
    deck: 'Continuous batching keeps the GPU from waiting on one conversation.',
    start: 931,
    end: 1190,
    readMinutes: 5,
    diagramCount: 2,
    keyPoints: [
      'Serving engines schedule many requests together.',
      'PagedAttention manages KV cache blocks.',
      'A queue is a product decision, not just an implementation detail.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'A serving engine sits between a stream of requests and a small number of GPUs. It decides which prompts get prefilled, which decodes get another token, and whose cache can stay in memory.',
      },
      {
        type: 'p',
        text: 'vLLM made paged KV cache management a default part of that job. Instead of reserving one contiguous block for every conversation, it pages the cache, so memory can be shared and reclaimed as requests arrive and finish.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'The engine is not just a wrapper around the model. It is where throughput, latency, and memory policy actually meet.',
      },
    ],
  },
  {
    id: 'prefill-decode',
    number: 5,
    title: 'Prefill reads. Decode writes.',
    short: 'Prefill vs decode',
    deck: 'One is a burst of math. The other is a memory-bound loop.',
    start: 1191,
    end: 1483,
    readMinutes: 4,
    diagramCount: 2,
    keyPoints: [
      'Prefill runs in parallel over the prompt.',
      'Decode produces one token per pass.',
      'The two phases stress different hardware limits.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'Prefill has the whole prompt at once, so it can use the GPU broadly. Decode has one new token at a time, so it spends more time reading weights and cache than doing fresh math.',
      },
      {
        type: 'p',
        text: 'That difference is the reason a chat can feel slow for a moment and then stream quickly. The pause is the prompt being read. The stream is the decode loop finding its rhythm.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'Prefill is compute-bound. Decode is memory-bound. Optimizing one does not automatically optimize the other.',
      },
    ],
  },
  chapterSix,
  {
    id: 'batching',
    number: 7,
    title: 'Batching trades latency for throughput.',
    short: 'Batching',
    deck: 'The GPU can serve more people when it stops waiting.',
    start: 1711,
    end: 1882,
    readMinutes: 5,
    diagramCount: 2,
    keyPoints: [
      'Batching fills the gaps between tokens.',
      'More concurrency can lower cost and raise latency.',
      'The KV cache limits how large a batch can grow.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'Serving one request at a time leaves the GPU idle between tokens. Batching puts several requests through the same pass, so the hardware has more work to do while each person waits for their next word.',
      },
      {
        type: 'p',
        text: 'The trade is not free. A larger batch can improve total throughput while making any single request wait longer. The right batch size depends on whether the product values cost, latency, or both.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'Batching is a throughput lever, not a latency cure. The cache is what makes a large batch possible without re-reading every prompt.',
      },
    ],
  },
  {
    id: 'sharding',
    number: 8,
    title: 'A giant model does not fit on one GPU.',
    short: 'Sharding a giant',
    deck: 'Sharding splits weights and work across devices.',
    start: 1883,
    end: 2079,
    readMinutes: 5,
    diagramCount: 2,
    keyPoints: [
      'Tensor parallelism splits one layer across devices.',
      'Pipeline parallelism splits layers into stages.',
      'Every split adds communication.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'When the weights are larger than the memory on one device, the model has to be split. Tensor parallelism divides the math inside a layer. Pipeline parallelism gives different layers to different stages.',
      },
      {
        type: 'p',
        text: 'The bill arrives as communication. Every split that needs a result from another device adds a hop, and those hops are much slower than reading from local memory.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'Sharding makes a model fit. It does not make the model free. The interconnect becomes part of the serving budget.',
      },
    ],
  },
  {
    id: 'routing',
    number: 9,
    title: 'Round-robin routing breaks the cache.',
    short: 'Load balancers fail',
    deck: 'The same prefix needs the same GPU.',
    start: 2080,
    end: 2286,
    readMinutes: 4,
    diagramCount: 1,
    keyPoints: [
      'A cache hit depends on the prefix.',
      'A random GPU is often a cache miss.',
      'Routing has to know where the cache lives.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'A normal load balancer spreads requests across healthy machines. That is the wrong default for prefix caching. If two requests share a long prompt but land on different GPUs, both have to prefill it.',
      },
      {
        type: 'p',
        text: 'Cache-aware routing sends a request to a machine that already holds its prefix. The hard part is keeping that map fresh as caches fill, evict, and move.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'The cache turns routing into a locality problem. A balanced fleet can still be a slow fleet if every request misses.',
      },
    ],
  },
  {
    id: 'llm-d',
    number: 10,
    title: 'LLM-D makes the cache a routing problem.',
    short: 'LLM-D',
    deck: 'Prefill and decode can run on different pools, with cache-aware routing in between.',
    start: 2287,
    end: 3059,
    readMinutes: 6,
    diagramCount: 2,
    keyPoints: [
      'Disaggregation gives prefill and decode different pools.',
      'KV cache has to move between them.',
      'The scheduler is now a distributed systems problem.',
    ],
    blocks: [
      {
        type: 'p',
        text: 'If prefill and decode want different things from hardware, running them on the same GPU is a compromise. Disaggregated serving gives each phase its own pool.',
      },
      {
        type: 'p',
        text: 'The price is a new network hop: the KV cache produced by prefill has to reach the decode worker. LLM-D is one attempt to make that split, plus cache-aware routing, feel like a single serving system.',
      },
      {
        type: 'callout',
        label: 'What to remember',
        text: 'The model stays the same. The system around it changes: more pools, more routing, more places for memory to live.',
      },
    ],
  },
]

export const SEEDED_GUIDE: Guide = {
  id: 'ai-infrastructure',
  title: 'AI Infrastructure Explained',
  channel: 'KodeKloud',
  youtubeId: 'hBzUokVYQkI',
  thumbnail: '/ai-infrastructure.jpg',
  duration: 3059,
  chapterCount: 10,
  readMinutes: 18,
  diagramCount: 3,
  webSourceCount: 1,
  progress: 0.52,
  minutesLeft: 18,
  chapters: otherChapters,
  recentHighlights: [
    {
      id: 'h1',
      quote: 'the KV cache is the trick that breaks the loop',
      chapterId: 'kv-cache',
      seconds: 1513,
    },
    {
      id: 'h2',
      quote: 'memory, not compute, sets the ceiling',
      chapterId: 'kv-cache',
      seconds: 1850,
    },
  ],
  sources: SOURCES,
  accent: '#E9FF4F',
}

export function getChapter(guide: Guide, chapterId: string | null | undefined): Chapter {
  return (
    guide.chapters.find((chapter) => chapter.id === chapterId) ??
    guide.chapters[Math.min(5, Math.max(0, guide.chapters.length - 1))]
  )
}

export function getChapterByNumber(guide: Guide, number: number): Chapter {
  return (
    guide.chapters.find((chapter) => chapter.number === number) ??
    guide.chapters[Math.min(5, Math.max(0, guide.chapters.length - 1))]
  )
}

export function getSource(sourceId: string): Source {
  return SOURCES.find((source) => source.id === sourceId) ?? SOURCES[0]
}
