import { useEffect, useState, type FormEvent } from 'react'
import { clearKeys, getKeyStatus, saveKeys, testKeys, type KeyStatus, type TestResult } from '../lib/api'
import { DEFAULT_MODEL, readPrefs, writePrefs } from '../lib/storage'
import { Link } from '../lib/router'
import { GITHUB_URL } from './SiteHeader'
import { Brand } from './Brand'
import { useToast } from './Toast'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  KeyIcon,
  LockIcon,
} from './Icons'
import { NebiusMark, TavilyMark } from './Marks'

const MODELS = [
  { id: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', label: 'DeepSeek V4.1' },
  { id: 'Qwen/Qwen3-235B-A22B-Instruct-2507', label: 'Qwen3 235B' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
]

export function Keys() {
  const prefs = readPrefs()
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [offline, setOffline] = useState(false)
  const [nebius, setNebius] = useState('')
  const [tavily, setTavily] = useState('')
  const [showNebius, setShowNebius] = useState(false)
  const [showTavily, setShowTavily] = useState(false)
  const [model, setModel] = useState(prefs.model)
  const [webSearch, setWebSearch] = useState(prefs.webSearch)
  const [test, setTest] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()

  const refreshStatus = async () => {
    try {
      const next = await getKeyStatus()
      setStatus(next)
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  const handleTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      const result = await testKeys({
        ...(nebius.trim() ? { nebius: nebius.trim() } : {}),
        ...(tavily.trim() ? { tavily: tavily.trim() } : {}),
      })
      setTest(result)
      const allOk = (!result.nebius || result.nebius.ok) && (!result.tavily || result.tavily.ok)
      if (allOk) notify('Connections are working.', 'success')
      else notify('One connection needs attention.', 'error')
    } catch (error) {
      setTest(null)
      notify(error instanceof Error ? error.message : 'Could not test the keys.', 'error')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await saveKeys({
        ...(nebius.trim() ? { nebius: nebius.trim() } : {}),
        ...(tavily.trim() ? { tavily: tavily.trim() } : {}),
        model,
        webSearch,
      })
      setNebius('')
      setTavily('')
      setShowNebius(false)
      setShowTavily(false)
      setStatus(result)
      setTest(result.validation ?? null)
      writePrefs({ model, webSearch })
      notify('Keys saved to the Keychain.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the keys.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Remove both keys from the Keychain?')) return
    try {
      const next = await clearKeys()
      setStatus(next)
      setTest(null)
      setNebius('')
      setTavily('')
      notify('Keys cleared.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not clear the keys.', 'error')
    }
  }

  const nebiusOk = test?.nebius?.ok
  const tavilyOk = test?.tavily?.ok
  const configured = Boolean(status?.nebius || status?.tavily)

  return (
    <div className="page page--keys">
      <header className="settings-header">
        <div className="settings-header__left">
          <Link to="/" className="settings-header__back" aria-label="Back to app">
            <ChevronLeftIcon size={17} />
          </Link>
          <Brand height={23} />
          <span className="settings-header__label settings-header__label--desktop">
            Settings <span className="settings-header__slash">/</span> Connections
          </span>
          <span className="settings-header__label settings-header__label--mobile">Keys</span>
        </div>
        <div className="settings-header__right">
          <Link to="/">Back to app</Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRightIcon size={12} />
          </a>
        </div>
      </header>

      <main className="settings-main">
        <p className="eyebrow">
          <span className="square-dot" aria-hidden="true" />
          Settings · Connections
        </p>
        <h1>Bring your own keys.</h1>
        <p className="settings-lede">
          Dogear runs on your Nebius Token Factory key. Tavily is optional, for web research. Both
          stay on this machine.
        </p>

        <form className="keys-card" onSubmit={handleSave}>
          <section className="keys-section">
            <div className="keys-section__head">
              <div className="keys-section__brand">
                <NebiusMark height={27} />
                <span className="mono-label">Models</span>
              </div>
              <span className="status-pill status-pill--required">
                <span className="status-dot" aria-hidden="true" /> Required
              </span>
            </div>

            <label className="field-label" htmlFor="nebius-key">
              API key
            </label>
            <div className={`key-field ${status?.nebius ? 'is-configured' : ''}`}>
              <KeyIcon size={14} />
              <input
                id="nebius-key"
                type={showNebius ? 'text' : 'password'}
                value={nebius}
                onChange={(event) => setNebius(event.target.value)}
                placeholder={status?.nebius ? 'Stored in Keychain' : 'nbs_…'}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="nebius-key-help"
              />
              <button
                type="button"
                className="key-field__show"
                onClick={() => setShowNebius((current) => !current)}
                disabled={!nebius}
                title={!nebius ? 'The stored key cannot be revealed from the app.' : undefined}
              >
                {showNebius && nebius ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="field-foot" id="nebius-key-help">
              <a href="https://tokenfactory.nebius.com" target="_blank" rel="noreferrer">
                Get a key at tokenfactory.nebius.com <ArrowUpRightIcon size={10} />
              </a>
              <span>{status?.nebius ? 'Stored locally' : 'Not set'}</span>
            </div>

            <label className="field-label" htmlFor="model">
              Model
            </label>
            <div className="model-field">
              <select id="model" value={model} onChange={(event) => setModel(event.target.value)}>
                {MODELS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
                {!MODELS.some((item) => item.id === DEFAULT_MODEL) ? (
                  <option value={DEFAULT_MODEL}>DeepSeek V4.1</option>
                ) : null}
              </select>
              <span className="model-field__change">Change</span>
            </div>
            <p className="field-note">We test the key before saving.</p>
          </section>

          <div className="keys-divider" />

          <section className="keys-section">
            <div className="keys-section__head">
              <div className="keys-section__brand">
                <TavilyMark size={24} />
                <span className="mono-label">Search</span>
              </div>
              <span className="status-pill status-pill--optional">
                <span className="status-dot" aria-hidden="true" /> Optional
              </span>
            </div>

            <div className="toggle-row">
              <div>
                <strong>Web research</strong>
                <span>Only when you ask for the web.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={webSearch}
                className={`switch ${webSearch ? 'is-on' : ''}`}
                onClick={() => setWebSearch((current) => !current)}
              >
                <span />
              </button>
            </div>

            <label className="field-label" htmlFor="tavily-key">
              API key
            </label>
            <div className={`key-field ${status?.tavily ? 'is-configured' : ''}`}>
              <KeyIcon size={14} />
              <input
                id="tavily-key"
                type={showTavily ? 'text' : 'password'}
                value={tavily}
                onChange={(event) => setTavily(event.target.value)}
                placeholder={status?.tavily ? 'Stored in Keychain' : 'tvly-…'}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="tavily-key-help"
              />
              <button
                type="button"
                className="key-field__show"
                onClick={() => setShowTavily((current) => !current)}
                disabled={!tavily}
                title={!tavily ? 'The stored key cannot be revealed from the app.' : undefined}
              >
                {showTavily && tavily ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="field-foot" id="tavily-key-help">
              <a href="https://tavily.com" target="_blank" rel="noreferrer">
                Get a key at tavily.com <ArrowUpRightIcon size={10} />
              </a>
              <span>{status?.tavily ? 'Stored locally' : 'Not set'}</span>
            </div>
          </section>

          <div className="keys-card__foot">
            <div className="keys-privacy">
              <LockIcon size={13} />
              <span>
                {status?.keychain
                  ? 'Keys stay in your macOS Keychain. Nothing leaves this machine.'
                  : 'Keys stay on this machine. Nothing leaves this machine.'}
              </span>
            </div>
            {configured ? (
              <button type="button" className="keys-clear" onClick={handleClear}>
                Clear keys
              </button>
            ) : null}
          </div>

          <div className="keys-env">
            Prefer env vars? Set <code>NEBIUS_API_KEY</code> and <code>TAVILY_API_KEY</code> in{' '}
            <code>.env</code>.
          </div>

          {offline ? (
            <p className="keys-offline" role="status">
              The local API is not running. Start it with <code>npm run dev</code>.
            </p>
          ) : null}

          {test ? (
            <div className="connection-result" role="status">
              {test.nebius ? (
                <span className={test.nebius.ok ? 'is-ok' : 'is-bad'}>
                  {test.nebius.ok ? <CheckIcon size={11} /> : null} Nebius{' '}
                  {test.nebius.ok ? 'connected' : test.nebius.detail || 'rejected the key'}
                </span>
              ) : null}
              {test.tavily ? (
                <span className={test.tavily.ok ? 'is-ok' : 'is-bad'}>
                  {test.tavily.ok ? <CheckIcon size={11} /> : null} Tavily{' '}
                  {test.tavily.ok ? 'connected' : test.tavily.detail || 'rejected the key'}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="keys-actions">
            <button type="button" className="button button--ghost" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button type="submit" className="button button--dark" disabled={saving}>
              {saving ? 'Saving…' : 'Save keys'} <ArrowRightIcon size={15} />
            </button>
          </div>
        </form>

        <p className="settings-footnote">
          {nebiusOk === false || tavilyOk === false ? (
            <span className="settings-warning">A key was rejected by the provider.</span>
          ) : (
            <span>Only the keys you add here are used for your own requests.</span>
          )}
        </p>
      </main>

    </div>
  )
}
