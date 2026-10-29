import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { jsonrepair } from 'jsonrepair'
import { parseYouTubeId, prepareYouTubeGuide } from './compile.mjs'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const LIBRARY_DIR = path.join(ROOT, 'data', 'library')
const CONFIG_DIR = path.join(os.homedir(), '.config', 'dogear')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')
const FALLBACK_KEYS_FILE = path.join(CONFIG_DIR, 'keys.json')
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const USER = process.env.USER || os.userInfo().username
const IS_MAC = process.platform === 'darwin'
const KEYCHAIN_SERVICES = { nebius: 'dogear.nebius', tavily: 'dogear.tavily' }
const DEFAULT_MODEL = process.env.DOGEAR_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash-1017'
const MAX_BODY = 1_500_000

const DEMO_SOURCES = [
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
    more: [],
    why: 'Chosen for its plain description of what is actually stored.',
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
    ],
    keyPoints: ['141GB of HBM3e memory.', 'Higher bandwidth helps memory-bound decode.'],
    more: [],
    why: 'Included to verify the memory number used in the chapter.',
    verified: true,
  },
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function sendError(response, status, message, extra = {}) {
  sendJson(response, status, { error: message, ...extra })
}

function cors(request, response) {
  const origin = request.headers.origin
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  }
}

async function readBody(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

async function readSettings() {
  try {
    const parsed = JSON.parse(await readFile(SETTINGS_FILE, 'utf8'))
    return {
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_MODEL,
      webSearch: typeof parsed.webSearch === 'boolean' ? parsed.webSearch : true,
    }
  } catch {
    return { model: DEFAULT_MODEL, webSearch: true }
  }
}

async function writeSettings(next) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
}

async function readFallbackKeys() {
  try {
    const parsed = JSON.parse(await readFile(FALLBACK_KEYS_FILE, 'utf8'))
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

async function writeFallbackKeys(keys) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(FALLBACK_KEYS_FILE, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 })
  await chmod(FALLBACK_KEYS_FILE, 0o600)
}

async function getKeychainKey(service) {
  try {
    const { stdout } = await execFileAsync(
      'security',
      ['find-generic-password', '-s', service, '-a', USER, '-w'],
      { timeout: 5000, maxBuffer: 32 * 1024 },
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function setKeychainKey(service, value) {
  try {
    await execFileAsync(
      'security',
      [
        'add-generic-password',
        '-U',
        '-a',
        USER,
        '-s',
        service,
        '-l',
        'Dogear',
        '-T',
        '/usr/bin/security',
        '-w',
        value,
      ],
      { timeout: 10_000, maxBuffer: 32 * 1024 },
    )
  } catch {
    throw new Error('Could not write to the Keychain. Unlock Keychain and try again.')
  }
}

async function removeKeychainKey(service) {
  try {
    await execFileAsync('security', ['delete-generic-password', '-s', service, '-a', USER], {
      timeout: 5000,
    })
  } catch {
    // The item may not exist.
  }
}

async function getStoredKey(name) {
  const envName = name === 'nebius' ? 'NEBIUS_API_KEY' : 'TAVILY_API_KEY'
  if (process.env[envName]) return { value: process.env[envName], source: 'env' }
  if (IS_MAC) {
    const value = await getKeychainKey(KEYCHAIN_SERVICES[name])
    if (value) return { value, source: 'keychain' }
  }
  const keys = await readFallbackKeys()
  if (typeof keys[name] === 'string' && keys[name]) return { value: keys[name], source: 'file' }
  return null
}

async function setStoredKey(name, value) {
  if (IS_MAC) {
    await setKeychainKey(KEYCHAIN_SERVICES[name], value)
    return
  }
  const keys = await readFallbackKeys()
  keys[name] = value
  await writeFallbackKeys(keys)
}

async function removeStoredKey(name) {
  if (IS_MAC) {
    await removeKeychainKey(KEYCHAIN_SERVICES[name])
    return
  }
  const keys = await readFallbackKeys()
  delete keys[name]
  await writeFallbackKeys(keys)
}

async function keyStatus() {
  const [nebius, tavily] = await Promise.all([getStoredKey('nebius'), getStoredKey('tavily')])
  const settings = await readSettings()
  return {
    nebius: Boolean(nebius),
    tavily: Boolean(tavily),
    keychain: IS_MAC,
    env: {
      nebius: Boolean(process.env.NEBIUS_API_KEY),
      tavily: Boolean(process.env.TAVILY_API_KEY),
    },
    model: settings.model,
  }
}

const FALLBACK_MODELS = [
  { id: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', name: 'DeepSeek V4.1 Flash 1017', vendor: 'deepseek', type: 'image2text', contextK: 1048 },
  { id: 'Qwen/Qwen3-235B-A22B-Instruct-2507', name: 'Qwen3 235B A22B Instruct', vendor: 'Qwen', type: 'text2text', contextK: 262 },
  { id: 'MiniMaxAI/MiniMax-M3.1-Flash', name: 'MiniMax M3.1 Flash', vendor: 'MiniMaxAI', type: 'image2text', contextK: 1049 },
]

let modelCache = { at: 0, models: null }

async function getModelCatalog() {
  if (modelCache.models && Date.now() - modelCache.at < 60 * 60 * 1000) {
    return { models: modelCache.models, source: 'live' }
  }
  try {
    const response = await fetch('https://tokenfactory.nebius.com/api/public/models_info', {
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error('Catalog unavailable.')
    const rows = await response.json()
    const seen = new Set()
    const models = []
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.status && row.status !== 'active') continue
      for (const flavor of Array.isArray(row.flavors) ? row.flavors : []) {
        if (flavor.model_type !== 'text2text' && flavor.model_type !== 'image2text') continue
        if (!flavor.model_id || seen.has(flavor.model_id)) continue
        seen.add(flavor.model_id)
        models.push({
          id: flavor.model_id,
          name: flavor.model_name || row.name || flavor.model_id,
          vendor: row.vendor || 'other',
          type: flavor.model_type,
          contextK: flavor.context_window_k || row.context_window_k || 0,
        })
      }
    }
    if (!models.length) throw new Error('Catalog was empty.')
    models.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.name.localeCompare(b.name))
    modelCache = { at: Date.now(), models }
    return { models, source: 'live' }
  } catch {
    return { models: FALLBACK_MODELS, source: 'fallback' }
  }
}

const GUIDE_LEVELS = new Set(['ELI5', 'ELI15', 'Undergrad', 'Expert'])
const GUIDE_PURPOSES = new Set(['understand', 'interview', 'build', 'overview'])
const GUIDE_VERSION = 5

const LEVEL_GUIDANCE = {
  ELI5: 'Explain like the reader is five. Use concrete, everyday analogies and short sentences.',
  ELI15: 'Explain for a curious adult. Define the terms that matter and keep the language plain.',
  Undergrad: 'Explain for a technical reader. Be precise about mechanisms, constraints, and tradeoffs.',
  Expert: 'Write for an expert. Skip basics, focus on architecture, edge cases, and the decisions that matter.',
}

const PURPOSE_GUIDANCE = {
  understand: 'Build a clear mental model. Use examples and connect each idea to the bigger argument.',
  interview: 'Focus on the claims, tradeoffs, and likely interview questions. Add an interview angle where useful.',
  build: 'Turn the material into practical decisions, implementation steps, and pitfalls.',
  overview: 'Keep the spine of the argument. Be concise and skip detours.',
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

function secondsFrom(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    if (value.includes(':')) {
      const parts = value.split(':').map(Number)
      if (parts.every(Number.isFinite)) {
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if (parts.length === 2) return parts[0] * 60 + parts[1]
      }
    }
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function transcriptForModel(cues) {
  const lines = []
  let start = null
  let parts = []
  for (const cue of cues) {
    if (start === null) start = cue.start
    parts.push(cue.text)
    if (cue.end - start >= 20 || parts.length >= 36) {
      lines.push(`[${formatClock(start)}] ${parts.join(' ')}`)
      start = null
      parts = []
    }
  }
  if (parts.length) lines.push(`[${formatClock(start ?? 0)}] ${parts.join(' ')}`)
  return lines.join('\n')
}

function parseModelJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('The model did not return a guide.')
  const json = candidate.slice(start, end + 1)
  try {
    return JSON.parse(json)
  } catch {
    try {
      return JSON.parse(jsonrepair(json))
    } catch {
      throw new Error('The model returned an unreadable guide. Try again.')
    }
  }
}

async function generateGuideJson({ model, level, purpose, meta, cues, extraInstruction = '' }) {
  const stored = await getStoredKey('nebius')
  if (!stored) throw new Error('Add a Nebius Token Factory key in Keys to compile a learning guide.')

  const schema = `{
  "deck": "One-sentence promise for the guide",
  "chapters": [
    {
      "title": "Specific teaching title",
      "short": "2 to 4 words",
      "deck": "One-sentence chapter summary",
      "start": 0,
      "end": 120,
      "keyPoints": ["Point one", "Point two"],
      "blocks": [
        {"type": "p", "text": "A short explanatory paragraph."},
        {"type": "callout", "label": "Mental model", "text": "One sentence to keep."},
        {"type": "recall", "question": "A question that tests understanding.", "answer": "A short model answer."}
      ]
    }
  ]
}`

  const system = [
    'You are Dogear, an editor who turns video transcripts into learning guides.',
    'Return only valid JSON. No markdown fences, no commentary, no em dashes.',
    'Do not paste the transcript. Paraphrase, explain, and connect the ideas.',
    'Every claim must be supported by the transcript. If the transcript is uncertain, say so.',
    'Use the transcript timestamps to place chapter boundaries in seconds.',
    'Escape quotation marks inside strings and do not use trailing commas.',
  ].join(' ')

  const minChapters = meta.duration >= 1200 ? 6 : meta.duration >= 600 ? 5 : 3

  const user = [
    `Video: ${meta.title}`,
    `Channel: ${meta.channel}`,
    `Duration: ${formatClock(meta.duration)}`,
    `Reading level: ${level}. ${LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE.ELI15}`,
    `Purpose: ${purpose}. ${PURPOSE_GUIDANCE[purpose] || PURPOSE_GUIDANCE.understand}`,
    `Write ${minChapters} to ${minChapters + 2} chapters. Cover the whole video, not just the opening.`,
    'Build understanding, not a summary. Every chapter must explain mechanisms and causal links, not merely recap what was said.',
    'Each chapter needs 2 to 4 explanatory paragraphs, one callout labeled "Mental model", "Common mistake", "Try it", or "Interview angle", and one recall question with a model answer.',
    'For interview prep, make at least one recall question sound like a real interview question.',
    'Do not use generic titles like "Part 1". The guide should teach, not transcribe.',
    `JSON schema: ${schema}`,
    ...(extraInstruction ? [extraInstruction] : []),
    'Transcript:',
    transcriptForModel(cues),
  ].join('\n\n')

  const callModel = async (messages, temperature) => {
    const response = await fetch('https://api.tokenfactory.nebius.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stored.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 7000,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Nebius rejected the key. Check it in Keys.')
      }
      throw new Error(`Nebius returned ${response.status}.`)
    }
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('Nebius returned an empty guide.')
    return content
  }

  const content = await callModel(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    0.2,
  )

  try {
    return parseModelJson(content)
  } catch {
    const repaired = await callModel(
      [
        {
          role: 'system',
          content: `${system} Return one valid JSON object only. No commentary.`,
        },
        {
          role: 'user',
          content: [
            'The previous guide response was not valid JSON. Repair it and return the same guide as valid JSON only.',
            `Schema: ${schema}`,
            'Previous output:',
            content.slice(0, 14000),
          ].join('\n\n'),
        },
      ],
      0,
    )
    try {
      return parseModelJson(repaired)
    } catch {
      throw new Error('The model returned an unreadable guide twice. Try again.')
    }
  }
}

function normalizeGuideJson(parsed, prepared, level, purpose) {
  const rawChapters = Array.isArray(parsed?.chapters) ? parsed.chapters : []
  if (rawChapters.length < 2) throw new Error('The model did not return enough chapters.')
  const duration = prepared.meta.duration
  const step = duration / rawChapters.length
  let chapters = rawChapters.map((raw, index) => {
    const title = typeof raw?.title === 'string' ? raw.title.trim() : ''
    const start = Math.max(0, Math.min(duration - 1, secondsFrom(raw?.start, index * step)))
    const rawBlocks = Array.isArray(raw?.blocks) ? raw.blocks : []
    const blocks = rawBlocks
      .map((block) => {
        if (typeof block === 'string') return { type: 'p', text: block.trim() }
        if (!block || typeof block !== 'object') return null
        if (block.type === 'recall') {
          const question = typeof block.question === 'string' ? block.question.trim() : ''
          const answer = typeof block.answer === 'string' ? block.answer.trim() : ''
          return question && answer ? { type: 'recall', question, answer } : null
        }
        const text = typeof block.text === 'string' ? block.text.trim() : ''
        if (!text) return null
        if (block.type === 'callout' || typeof block.label === 'string') {
          return { type: 'callout', label: typeof block.label === 'string' ? block.label : 'What to remember', text }
        }
        return { type: 'p', text }
      })
      .filter(Boolean)
    const keyPoints = Array.isArray(raw?.keyPoints)
      ? raw.keyPoints.filter((point) => typeof point === 'string' && point.trim()).slice(0, 4)
      : []
    if (!blocks.some((block) => block.type === 'recall')) {
      blocks.push({
        type: 'recall',
        question: `Can you explain ${title || 'this idea'} without looking?`,
        answer: keyPoints[0] || (typeof raw?.deck === 'string' ? raw.deck : 'Try explaining the mechanism in your own words.'),
      })
    }
    const words = blocks.reduce(
      (total, block) =>
        total + (block.type === 'recall' ? `${block.question} ${block.answer}` : block.text).split(/\s+/).length,
      0,
    )
    return {
      title: title || `Chapter ${index + 1}`,
      short: typeof raw?.short === 'string' && raw.short.trim() ? raw.short.trim().slice(0, 40) : `Chapter ${index + 1}`,
      deck: typeof raw?.deck === 'string' ? raw.deck.trim() : '',
      start,
      end: secondsFrom(raw?.end, start + step),
      keyPoints,
      blocks,
      words,
    }
  }).filter((chapter) => chapter.blocks.length > 0)

  chapters.sort((a, b) => a.start - b.start)
  if (chapters.length < 2) throw new Error('The model did not return enough usable chapters.')
  chapters = chapters.map((chapter, index) => {
    const next = chapters[index + 1]
    const start = index === 0 ? Math.min(chapter.start, duration - 1) : chapter.start
    const end = next ? Math.max(start + 5, next.start) : duration
    return {
      id: `chapter-${index + 1}`,
      number: index + 1,
      title: chapter.title,
      short: chapter.short,
      deck: chapter.deck,
      start,
      end: Math.min(duration, Math.max(start + 5, end)),
      readMinutes: Math.max(1, Math.round(chapter.words / 220)),
      diagramCount: 0,
      keyPoints: chapter.keyPoints,
      blocks: chapter.blocks,
    }
  })

  const guideDeck = typeof parsed?.deck === 'string' && parsed.deck.trim()
    ? parsed.deck.trim()
    : chapters[0].deck
  const watchUrl = `https://www.youtube.com/watch?v=${prepared.videoId}`
  const readMinutes = chapters.reduce((total, chapter) => total + chapter.readMinutes, 0)

  return {
    id: prepared.guideId,
    title: prepared.meta.title,
    channel: prepared.meta.channel,
    youtubeId: prepared.videoId,
    thumbnail: prepared.meta.thumbnail,
    duration,
    chapterCount: chapters.length,
    readMinutes,
    diagramCount: 0,
    webSourceCount: 1,
    progress: 0.08,
    minutesLeft: Math.max(1, Math.round(readMinutes * 0.92)),
    level,
    purpose,
    guideVersion: GUIDE_VERSION,
    chapters,
    recentHighlights: [],
    transcript: prepared.cues.map((cue) => ({ start: Math.round(cue.start), text: cue.text })),
    sources: [
      {
        id: 'youtube-transcript',
        short: 'YouTube',
        title: prepared.meta.title,
        domain: 'youtube.com',
        published: 'Live',
        readTime: 'Video',
        url: watchUrl,
        usedFor: guideDeck,
        extract: [guideDeck],
        keyPoints: chapters[0].keyPoints,
        more: [{ title: 'Open on YouTube', href: watchUrl }],
        why: 'Compiled from the video transcript and written by your connected model.',
        verified: true,
      },
    ],
    accent: '#E9FF4F',
  }
}

async function callGuideCompletion({ stored, model, messages, maxTokens = 2200, temperature = 0.2 }) {
  const response = await fetch('https://api.tokenfactory.nebius.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stored.value}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Nebius rejected the key. Check it in Keys.')
    }
    throw new Error(`Nebius returned ${response.status}.`)
  }
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Nebius returned an empty guide.')
  return content
}

async function generateOutline({ stored, model, level, purpose, meta, cues, extraInstruction = '' }) {
  const minChapters = meta.duration >= 1200 ? 6 : meta.duration >= 600 ? 5 : 3
  const schema = `{
  "deck": "One-sentence promise for the guide",
  "chapters": [
    {
      "title": "Specific teaching title",
      "short": "2 to 4 words",
      "start": 0,
      "end": 120,
      "deck": "One-sentence chapter summary",
      "focus": "The one mechanism the reader must understand",
      "keyPoints": ["Point one", "Point two"]
    }
  ]
}`
  const system = [
    'You are Dogear, an editor who turns video transcripts into learning guides.',
    'Return only valid JSON. No markdown fences, no commentary, no em dashes.',
    'Do not paste the transcript. Paraphrase, explain, and connect the ideas.',
    'Every claim must be supported by the transcript.',
    'Use the transcript timestamps to place chapter boundaries in seconds.',
    'Escape quotation marks inside strings and do not use trailing commas.',
  ].join(' ')
  const user = [
    `Video: ${meta.title}`,
    `Channel: ${meta.channel}`,
    `Duration: ${formatClock(meta.duration)}`,
    `Reading level: ${level}. ${LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE.ELI15}`,
    `Purpose: ${purpose}. ${PURPOSE_GUIDANCE[purpose] || PURPOSE_GUIDANCE.understand}`,
    `Write ${minChapters} to ${minChapters + 2} chapters. Cover the whole video, not just the opening.`,
    'This is the outline only. The chapter bodies are written in a second pass.',
    'Titles must be specific and teach the idea, not say "Part 1".',
    `JSON schema: ${schema}`,
    ...(extraInstruction ? [extraInstruction] : []),
    'Transcript:',
    transcriptForModel(cues),
  ].join('\n\n')
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  let content = ''
  try {
    content = await callGuideCompletion({ stored, model, messages, maxTokens: 2200 })
    return parseModelJson(content)
  } catch (firstError) {
    const repaired = await callGuideCompletion({
      stored,
      model,
      messages: [
        ...messages,
        {
          role: 'user',
          content: 'Return the same outline as one valid JSON object only. No prose, no code fences, no commentary.',
        },
      ],
      maxTokens: 2200,
      temperature: 0,
    })
    return parseModelJson(repaired)
  }
}

async function generateChapterBody({ stored, model, level, purpose, meta, outline, index }) {
  const previous = outline.chapters[index - 1]
  const next = outline.chapters[index + 1]
  const segment = meta.cues.filter(
    (cue) => cue.start >= outline.start - 3 && cue.end <= outline.end + 3,
  )
  const segmentCues = segment.length ? segment : meta.cues
  const schema = `{
  "title": "Specific teaching title for this chapter",
  "short": "2 to 4 words",
  "deck": "One-sentence chapter summary",
  "keyPoints": ["Point one", "Point two"],
  "blocks": [
    {"type": "p", "text": "A causal explanation, not a recap."},
    {"type": "p", "text": "A second explanation or concrete example."},
    {"type": "callout", "label": "Mental model | Common mistake | Try it | Interview angle", "text": "One sentence to keep."},
    {"type": "recall", "question": "A question that tests understanding.", "answer": "A short model answer."}
  ]
}`
  const system = [
    'You are Dogear, writing one chapter of a learning guide.',
    'Return only valid JSON. No markdown fences, no commentary, no em dashes.',
    'Build understanding, not a summary. Explain the mechanism and why it matters.',
    'Do not paste the transcript. Use concrete details from the transcript, but paraphrase them.',
    'Every claim must be supported by the transcript segment.',
  ].join(' ')
  const user = [
    `Video: ${meta.title}`,
    `Chapter ${index + 1} of ${outline.chapters.length}: ${outline.title || 'Untitled chapter'}`,
    outline.title
      ? `Chapter focus: ${outline.focus || outline.deck}`
      : 'Give this segment a specific teaching title and focus.',
    `Known key points: ${(outline.keyPoints || []).join(' · ')}`,
    `Previous chapter: ${previous ? previous.title : 'Start of the guide'}`,
    `Next chapter: ${next ? next.title : 'End of the guide'}`,
    `Level: ${level}. ${LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE.ELI15}`,
    `Purpose: ${purpose}. ${PURPOSE_GUIDANCE[purpose] || PURPOSE_GUIDANCE.understand}`,
    'Write 3 to 5 blocks. Include at least one p, one callout, and one recall question.',
    'The recall answer should explain the idea in one or two sentences.',
    `JSON schema: ${schema}`,
    `Transcript segment [${formatClock(outline.start)} to ${formatClock(outline.end)}]:`,
    transcriptForModel(segmentCues),
  ].join('\n\n')
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  const readBody = (parsed) => {
    if (!Array.isArray(parsed?.blocks) || parsed.blocks.length === 0) throw new Error('No blocks.')
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      short: typeof parsed.short === 'string' ? parsed.short.trim() : '',
      deck: typeof parsed.deck === 'string' ? parsed.deck.trim() : '',
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.filter((point) => typeof point === 'string' && point.trim()).slice(0, 4)
        : [],
      blocks: parsed.blocks,
    }
  }

  try {
    const content = await callGuideCompletion({ stored, model, messages, maxTokens: 1800 })
    return readBody(parseModelJson(content))
  } catch {
    try {
      const content = await callGuideCompletion({
        stored,
        model,
        messages: [
          ...messages,
          {
            role: 'user',
            content: 'Return this chapter as one valid JSON object only. No prose, no code fences.',
          },
        ],
        maxTokens: 1800,
        temperature: 0,
      })
      return readBody(parseModelJson(content))
    } catch {
      const fallback = outline.keyPoints?.[0] || outline.deck || outline.focus || outline.title
      const title = outline.title || `Chapter ${outline.number || index + 1}`
      return {
        title,
        short: outline.short || `Chapter ${index + 1}`,
        deck: outline.deck || '',
        keyPoints: outline.keyPoints || [],
        blocks: [
          { type: 'p', text: outline.focus || outline.deck || title },
          { type: 'p', text: fallback },
          { type: 'callout', label: 'What to remember', text: outline.deck || title },
          {
            type: 'recall',
            question: `Can you explain “${title}” without looking?`,
            answer: fallback,
          },
        ],
      }
    }
  }
}

function makeWindowOutline(meta, count) {
  const step = meta.duration / count
  return {
    deck: '',
    chapters: Array.from({ length: count }, (_, index) => {
      const start = Math.floor(index * step)
      const end = index === count - 1 ? meta.duration : Math.floor((index + 1) * step)
      return {
        title: '',
        short: `Chapter ${index + 1}`,
        deck: '',
        focus: '',
        keyPoints: [],
        start,
        end,
        number: index + 1,
      }
    }),
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function normalizeOutline(parsed, meta) {
  const rawChapters = Array.isArray(parsed?.chapters) ? parsed.chapters : []
  if (rawChapters.length < 2) throw new Error('The model did not return enough chapters.')
  const duration = meta.duration
  const step = duration / rawChapters.length
  const chapters = rawChapters
    .map((raw, index) => ({
      title: typeof raw?.title === 'string' ? raw.title.trim() : '',
      short:
        typeof raw?.short === 'string' && raw.short.trim()
          ? raw.short.trim().slice(0, 40)
          : typeof raw?.title === 'string'
            ? raw.title.split(/\s+/).slice(0, 4).join(' ')
            : `Chapter ${index + 1}`,
      deck: typeof raw?.deck === 'string' ? raw.deck.trim() : '',
      focus: typeof raw?.focus === 'string' ? raw.focus.trim() : '',
      keyPoints: Array.isArray(raw?.keyPoints)
        ? raw.keyPoints.filter((point) => typeof point === 'string' && point.trim()).slice(0, 4)
        : [],
      start: Math.max(0, Math.min(duration - 1, secondsFrom(raw?.start, index * step))),
    }))
    .filter((chapter) => chapter.title)
    .sort((a, b) => a.start - b.start)
    .map((chapter, index) => ({
      ...chapter,
      number: index + 1,
      start: index === 0 ? Math.min(chapter.start, duration - 1) : chapter.start,
      end: index < rawChapters.length - 1 ? chapter.start : duration,
    }))
  if (chapters.length < 2) throw new Error('The model did not return enough usable chapters.')
  for (let index = 0; index < chapters.length; index += 1) {
    const next = chapters[index + 1]
    chapters[index].end = next ? Math.max(chapters[index].start + 5, next.start) : duration
  }
  return {
    deck: typeof parsed?.deck === 'string' ? parsed.deck.trim() : chapters[0].deck,
    chapters,
  }
}

async function compileGuideWithNebius(value, { level, purpose, model }) {
  const videoId = parseYouTubeId(value)
  if (!videoId) throw new Error('That is not a valid YouTube link.')
  const guideId = `yt-${videoId.toLowerCase()}`
  try {
    const cached = JSON.parse(await readFile(path.join(LIBRARY_DIR, `${guideId}.json`), 'utf8'))
    if (cached.level === level && cached.purpose === purpose && cached.guideVersion === GUIDE_VERSION) {
      return guideId
    }
  } catch {
    // No usable cached guide.
  }

  const stored = await getStoredKey('nebius')
  if (!stored) throw new Error('Add a Nebius Token Factory key in Keys to compile a learning guide.')
  const prepared = await prepareYouTubeGuide(value)
  const settings = await readSettings()
  const selectedModel = typeof model === 'string' && model ? model : settings.model
  const minChapters = prepared.meta.duration >= 1200 ? 6 : prepared.meta.duration >= 600 ? 5 : 3
  let outline = null
  try {
    const outlineRaw = await generateOutline({
      stored,
      model: selectedModel,
      level,
      purpose,
      meta: prepared.meta,
      cues: prepared.cues,
    })
    const candidate = normalizeOutline(outlineRaw, prepared.meta)
    if (candidate.chapters.length >= minChapters) outline = candidate
  } catch {
    // Use a deterministic chapter map below if the model cannot outline.
  }
  if (!outline) outline = makeWindowOutline(prepared.meta, minChapters)
  const bodies = await mapLimit(outline.chapters, 2, async (chapter, index) =>
    generateChapterBody({
      stored,
      model: selectedModel,
      level,
      purpose,
      meta: { ...prepared.meta, cues: prepared.cues },
      outline: { ...chapter, chapters: outline.chapters },
      index,
    }),
  )
  const parsed = {
    deck: outline.deck,
    chapters: outline.chapters.map((chapter, index) => {
      const body = bodies[index]
      return {
        ...chapter,
        title: body.title || chapter.title || `Chapter ${index + 1}`,
        short: body.short || chapter.short || `Chapter ${index + 1}`,
        deck: body.deck || chapter.deck || '',
        keyPoints: body.keyPoints?.length ? body.keyPoints : chapter.keyPoints,
        blocks: body.blocks,
        start: chapter.start,
        end: chapter.end,
      }
    }),
  }
  const guide = normalizeGuideJson(parsed, prepared, level, purpose)
  await mkdir(LIBRARY_DIR, { recursive: true })
  await writeFile(path.join(LIBRARY_DIR, `${guideId}.json`), `${JSON.stringify(guide, null, 2)}\n`, {
    mode: 0o600,
  })
  return guideId
}

async function testNebius(key) {
  if (!key) return { ok: false, detail: 'No Nebius key is set.' }
  try {
    const response = await fetch('https://api.tokenfactory.nebius.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (response.ok) return { ok: true }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, detail: 'Nebius rejected the key. Check the Token Factory key.' }
    }
    return { ok: false, detail: `Nebius returned ${response.status}.` }
  } catch {
    return { ok: false, detail: 'Could not reach Nebius.' }
  }
}

async function testTavily(key) {
  if (!key) return { ok: false, detail: 'No Tavily key is set.' }
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'Tavily Search API', max_results: 1 }),
      signal: AbortSignal.timeout(20_000),
    })
    if (response.ok) return { ok: true }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, detail: 'Tavily rejected the key. Check the Tavily key.' }
    }
    return { ok: false, detail: `Tavily returned ${response.status}.` }
  } catch {
    return { ok: false, detail: 'Could not reach Tavily.' }
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'web'
  }
}

function normalizeTavilyResults(results, query) {
  return results.slice(0, 4).map((result, index) => {
    const domain = hostnameOf(result.url)
    const content =
      typeof result.content === 'string' && result.content.trim()
        ? result.content.trim().slice(0, 1600)
        : 'Tavily returned this page for the selected passage.'
    return {
      id: `tavily-${index + 1}`,
      short: domain,
      title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : domain,
      domain,
      published: 'Live',
      readTime: 'Web result',
      url: result.url,
      usedFor: query,
      extract: [content],
      keyPoints: [],
      more: [],
      why: 'Found by Tavily for this passage.',
      verified: false,
    }
  })
}

async function searchTavily(query) {
  const stored = await getStoredKey('tavily')
  if (!stored) return { sources: DEMO_SOURCES, demo: true }
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: stored.value,
      query,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
      max_results: 4,
    }),
    signal: AbortSignal.timeout(35_000),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Tavily rejected the key. Check it in Keys.')
    }
    throw new Error(`Tavily returned ${response.status}.`)
  }
  const data = await response.json()
  const sources = Array.isArray(data.results) ? normalizeTavilyResults(data.results, query) : []
  return { sources, demo: false }
}

async function askNebius({ question, context, quote, level, model }) {
  const stored = await getStoredKey('nebius')
  if (!stored) throw new Error('Add a Nebius Token Factory key to ask live questions.')
  const chosenModel = typeof model === 'string' && model ? model : DEFAULT_MODEL
  const system = [
    'You are Dogear, a reading companion for a chaptered video guide.',
    'Answer in at most two short paragraphs. Be direct and concrete.',
    'Use only the supplied chapter context. If the context does not answer, say so plainly.',
    'No markdown, no bullet lists, no em dashes.',
  ].join(' ')
  const user = [
    `Reading level: ${level || 'ELI15'}.`,
    `Selected highlight: ${quote || 'none'}.`,
    'Chapter context:',
    String(context || '').slice(0, 9000),
    `Question: ${String(question || '').slice(0, 800)}`,
  ].join('\n\n')

  const response = await fetch('https://api.tokenfactory.nebius.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stored.value}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chosenModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 420,
    }),
    signal: AbortSignal.timeout(55_000),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Nebius rejected the key. Check it in Keys.')
    }
    throw new Error(`Nebius returned ${response.status}.`)
  }
  const data = await response.json()
  const answer = data?.choices?.[0]?.message?.content
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('Nebius returned an empty answer.')
  return answer.trim()
}

async function handleApi(request, response, url) {
  cors(request, response)
  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, keychain: IS_MAC })
    return
  }

  if (url.pathname === '/api/models' && request.method === 'GET') {
    sendJson(response, 200, await getModelCatalog())
    return
  }

  if (url.pathname === '/api/keys/status' && request.method === 'GET') {
    sendJson(response, 200, await keyStatus())
    return
  }

  if (url.pathname === '/api/keys/test' && request.method === 'POST') {
    const body = await readBody(request)
    const storedNebius = await getStoredKey('nebius')
    const storedTavily = await getStoredKey('tavily')
    const nebiusKey = typeof body.nebius === 'string' && body.nebius.trim() ? body.nebius.trim() : storedNebius?.value
    const tavilyKey = typeof body.tavily === 'string' && body.tavily.trim() ? body.tavily.trim() : storedTavily?.value
    const [nebius, tavily] = await Promise.all([testNebius(nebiusKey), testTavily(tavilyKey)])
    sendJson(response, 200, { nebius, tavily })
    return
  }

  if (url.pathname === '/api/keys' && request.method === 'POST') {
    const body = await readBody(request)
    const providedNebius = typeof body.nebius === 'string' && body.nebius.trim() ? body.nebius.trim() : null
    const providedTavily = typeof body.tavily === 'string' && body.tavily.trim() ? body.tavily.trim() : null
    const validation = {}
    if (providedNebius) validation.nebius = await testNebius(providedNebius)
    if (providedTavily) validation.tavily = await testTavily(providedTavily)
    if (validation.nebius && !validation.nebius.ok) {
      sendError(response, 400, validation.nebius.detail || 'Nebius rejected the key.', { validation })
      return
    }
    if (validation.tavily && !validation.tavily.ok) {
      sendError(response, 400, validation.tavily.detail || 'Tavily rejected the key.', { validation })
      return
    }
    if (providedNebius) await setStoredKey('nebius', providedNebius)
    if (providedTavily) await setStoredKey('tavily', providedTavily)
    const settings = await readSettings()
    await writeSettings({
      model: typeof body.model === 'string' && body.model ? body.model : settings.model,
      webSearch: typeof body.webSearch === 'boolean' ? body.webSearch : settings.webSearch,
    })
    sendJson(response, 200, { ...(await keyStatus()), validation })
    return
  }

  if (url.pathname === '/api/keys' && request.method === 'DELETE') {
    await Promise.all([removeStoredKey('nebius'), removeStoredKey('tavily')])
    sendJson(response, 200, await keyStatus())
    return
  }

  if (url.pathname === '/api/search' && request.method === 'POST') {
    const body = await readBody(request)
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 500) : ''
    if (!query) {
      sendError(response, 400, 'A search query is required.')
      return
    }
    try {
      sendJson(response, 200, await searchTavily(query))
    } catch (error) {
      sendError(response, 502, error instanceof Error ? error.message : 'Tavily search failed.')
    }
    return
  }

  if (url.pathname === '/api/ask' && request.method === 'POST') {
    const body = await readBody(request)
    if (typeof body.question !== 'string' || !body.question.trim()) {
      sendError(response, 400, 'A question is required.')
      return
    }
    try {
      const answer = await askNebius({
        question: body.question,
        context: body.context,
        quote: body.quote,
        level: body.level,
        model: body.model,
      })
      sendJson(response, 200, { answer, mode: 'live' })
    } catch (error) {
      sendError(response, 503, error instanceof Error ? error.message : 'Nebius could not answer.')
    }
    return
  }

  if (url.pathname === '/api/compile' && request.method === 'POST') {
    const body = await readBody(request)
    const value = typeof body.url === 'string' ? body.url : ''
    if (value.includes('hBzUokVYQkI')) {
      sendJson(response, 200, { guideId: 'ai-infrastructure' })
      return
    }
    const level = GUIDE_LEVELS.has(body.level) ? body.level : 'ELI15'
    const purpose = GUIDE_PURPOSES.has(body.purpose) ? body.purpose : 'understand'
    try {
      const guideId = await compileGuideWithNebius(value, {
        level,
        purpose,
        model: body.model,
      })
      sendJson(response, 200, { guideId })
    } catch (error) {
      sendError(
        response,
        422,
        error instanceof Error ? error.message : 'The compiler could not build this guide.',
      )
    }
    return
  }

  if (url.pathname === '/api/library' && request.method === 'GET') {
    try {
      const files = (await readdir(LIBRARY_DIR)).filter((file) => file.endsWith('.json'))
      const entries = (
        await Promise.all(
          files.map(async (file) => {
            try {
              const guide = JSON.parse(await readFile(path.join(LIBRARY_DIR, file), 'utf8'))
              if (!guide || typeof guide.id !== 'string') return null
              return {
                id: guide.id,
                title: guide.title,
                channel: guide.channel,
                thumbnail: guide.thumbnail,
                duration: guide.duration,
                chapterCount: guide.chapterCount,
                readMinutes: guide.readMinutes,
                progress: guide.progress,
                firstChapter: guide.chapters?.[0]?.id,
              }
            } catch {
              return null
            }
          }),
        )
      ).filter(Boolean)
      sendJson(response, 200, { entries })
    } catch {
      sendJson(response, 200, { entries: [] })
    }
    return
  }

  if (url.pathname.startsWith('/api/transcript/') && request.method === 'GET') {
    const videoId = decodeURIComponent(url.pathname.slice('/api/transcript/'.length))
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      sendError(response, 400, 'Invalid video id.')
      return
    }
    try {
      const prepared = await prepareYouTubeGuide(`https://www.youtube.com/watch?v=${videoId}`)
      sendJson(response, 200, {
        transcript: prepared.cues.map((cue) => ({ start: Math.round(cue.start), text: cue.text })),
      })
    } catch (error) {
      sendError(response, 422, error instanceof Error ? error.message : 'Could not load the transcript.')
    }
    return
  }

  if (url.pathname.startsWith('/api/guides/') && request.method === 'GET') {
    const id = decodeURIComponent(url.pathname.slice('/api/guides/'.length))
    if (!/^[a-z0-9-]{1,80}$/.test(id)) {
      sendError(response, 400, 'Invalid guide id.')
      return
    }
    try {
      const file = path.join(LIBRARY_DIR, `${id}.json`)
      const data = await readFile(file, 'utf8')
      sendJson(response, 200, JSON.parse(data))
    } catch {
      sendError(response, 404, 'Guide not found.')
    }
    return
  }

  sendError(response, 404, 'Not found.')
}

async function serveStatic(request, response, url) {
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  const resolved = path.resolve(DIST, `.${pathname}`)
  if (!resolved.startsWith(`${DIST}${path.sep}`) && resolved !== path.join(DIST, 'index.html')) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }
  try {
    const info = await stat(resolved)
    if (info.isFile()) {
      const data = await readFile(resolved)
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': resolved.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      })
      response.end(data)
      return
    }
  } catch {
    // Fall through to the SPA entry.
  }
  try {
    const html = await readFile(path.join(DIST, 'index.html'))
    response.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })
    response.end(html)
  } catch {
    response.writeHead(404)
    response.end('Build the app first with npm run build.')
  }
}

const server = http.createServer(async (request, response) => {
  const started = Date.now()
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url)
    } else if (existsSync(DIST)) {
      await serveStatic(request, response, url)
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('The Dogear API is running. Start Vite with npm run dev.')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error.'
    if (!response.headersSent) sendError(response, 500, message)
    else response.end()
  } finally {
    const elapsed = Date.now() - started
    // Logs intentionally contain no request bodies or credentials.
    console.log(`${request.method} ${url.pathname} ${response.statusCode} ${elapsed}ms`)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Dogear API listening on http://${HOST}:${PORT}`)
  console.log(`Key storage: ${IS_MAC ? 'macOS Keychain' : 'local config file'}`)
})
