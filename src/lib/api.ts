import type { Source } from '../data/guide'

export interface KeyStatus {
  nebius: boolean
  tavily: boolean
  keychain: boolean
  env: { nebius: boolean; tavily: boolean }
  model?: string
}

export interface TestResult {
  nebius?: { ok: boolean; detail?: string }
  tavily?: { ok: boolean; detail?: string }
}

interface AskResponse {
  answer: string
  mode?: 'live' | 'demo'
}

interface SearchResponse {
  sources: Source[]
  demo?: boolean
}

interface CompileResponse {
  guideId?: string
  guide?: { id: string }
  error?: string
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 45_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
    const data = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}.`)
    }
    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request took too long. Try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function getKeyStatus(): Promise<KeyStatus> {
  return request<KeyStatus>('/api/keys/status')
}

export async function testKeys(payload: {
  nebius?: string
  tavily?: string
}): Promise<TestResult> {
  return request<TestResult>('/api/keys/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function saveKeys(payload: {
  nebius?: string
  tavily?: string
  model?: string
  webSearch?: boolean
}): Promise<KeyStatus & { validation?: TestResult }> {
  return request<KeyStatus & { validation?: TestResult }>('/api/keys', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function clearKeys(): Promise<KeyStatus> {
  return request<KeyStatus>('/api/keys', { method: 'DELETE' })
}

export async function ask(payload: {
  question: string
  quote?: string
  context: string
  level: string
  model?: string
}): Promise<AskResponse> {
  return request<AskResponse>(
    '/api/ask',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    60_000,
  )
}

export async function searchWeb(query: string, model?: string): Promise<SearchResponse> {
  return request<SearchResponse>(
    '/api/search',
    {
      method: 'POST',
      body: JSON.stringify({ query, model }),
    },
    60_000,
  )
}

export async function compile(url: string, level = 'ELI15', model?: string): Promise<CompileResponse> {
  return request<CompileResponse>(
    '/api/compile',
    {
      method: 'POST',
      body: JSON.stringify({ url, level, model }),
    },
    180_000,
  )
}

export interface LibraryEntry {
  id: string
  title: string
  channel: string
  thumbnail: string
  duration: number
  chapterCount: number
  readMinutes: number
  progress: number
  firstChapter?: string
}

export async function getLibrary(): Promise<LibraryEntry[]> {
  const data = await request<{ entries: LibraryEntry[] }>('/api/library')
  return data.entries
}
