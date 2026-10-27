import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { compileYouTubeGuide } from './compile.mjs'

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
    try {
      const guideId = await compileYouTubeGuide(value)
      sendJson(response, 200, { guideId })
    } catch (error) {
      sendError(
        response,
        422,
        error instanceof Error ? error.message : 'The compiler could not read this video.',
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
