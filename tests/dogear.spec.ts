import { expect, test } from '@playwright/test'

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('header uses the official Token Factory link and no redundant how-it-works link', async ({ page }) => {
    await page.goto('/')
    const nebius = page.getByRole('link', { name: 'Nebius Token Factory' }).first()
    await expect(nebius).toHaveAttribute('href', 'https://tokenfactory.nebius.com')
    await expect(page.getByRole('link', { name: 'How it works' })).toHaveCount(0)
  })

  test('keys page is reachable from home and the reader', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Keys' }).first().click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Bring your own keys.' })).toBeVisible()
    await expect(page.getByLabel('API key').first()).toBeVisible()
    await page.goto('/keys')
    await expect(page.getByRole('heading', { name: 'Bring your own keys.' })).toBeVisible()
    const createLinks = page.getByRole('link', { name: /Create one/i })
    await expect(createLinks).toHaveCount(2)
    await expect(createLinks.first()).toHaveAttribute(
      'href',
      'https://tokenfactory.nebius.com/project/api-keys',
    )
    await expect(createLinks.last()).toHaveAttribute('href', 'https://app.tavily.com/home')
  })

  test('home validates a URL and opens the seeded guide', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Paste a video/i })).toBeVisible()
    const input = page.getByLabel('YouTube video link')
    await input.fill('not a link')
    await page.getByRole('button', { name: 'Compile' }).click()
    await expect(page.getByRole('alert')).toContainText('Paste a YouTube link')

    await input.fill('https://youtu.be/hBzUokVYQkI')
    await page.getByRole('button', { name: 'Compile' }).click()
    await expect(page).toHaveURL(/\/read\/ai-infrastructure\?chapter=kv-cache/)
    await expect(page.getByRole('heading', { name: 'The cache that makes chat feel instant.' })).toBeVisible()
  })

  test('highlight, source popup, escape, and read view', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')

    await page.locator('.recent-highlight').first().click()
    await expect(page.locator('.highlight-toolbar')).toBeVisible()
    await expect(page.locator('.highlight-content h3')).toHaveText("The model's scratch pad.")
    await expect(page.locator('.quote-mark')).toHaveCount(1)
    await expect(page.locator('.recent-highlights--panel')).toBeVisible()
    await expect(page.locator('.recent-highlights--panel .recent-highlight')).toHaveCount(1)

    await page.locator('.article__deck').click()
    await expect(page.locator('.highlight-toolbar')).toHaveCount(0)
    await expect(page.locator('.highlights-aside')).toBeVisible()

    await page.getByRole('tab', { name: 'Source' }).click()
    await expect(page.locator('.source-card')).toBeVisible()
    await page.locator('.source-card').click()
    await expect(page.locator('.source-dialog--desktop')).toBeVisible()
    await expect(page.locator('.source-rail__card')).toHaveCount(4)
    await expect(page.locator('.source-main__title')).toHaveText('Prefix caching')
    await page.keyboard.press('Escape')
    await expect(page.locator('.source-dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Read view' }).click()
    await expect(page.locator('.contents-rail')).toHaveCount(0)
    await expect(page.locator('.highlights-aside')).toHaveCount(0)
    await expect(page.locator('.reader-main__mini')).toBeVisible()
  })

  test('deletes a recent highlight and keeps it deleted after reload', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    const rows = page.locator('.highlights-aside .recent-highlight-row')
    await expect(rows).toHaveCount(2)
    await page.locator('.highlights-aside .recent-highlight__delete').first().click()
    await expect(rows).toHaveCount(1)
    await page.reload()
    await expect(page.locator('.highlights-aside .recent-highlight-row')).toHaveCount(1)

    await page.locator('.highlights-aside .recent-highlight__delete').first().click()
    await expect(page.locator('.highlights-aside .recent-highlight-row')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.highlights-aside .recent-highlight-row')).toHaveCount(0)
  })

  test('highlight actions follow the selected chapter and passage', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=llm-d')
    const paragraph = page.locator('.article__paragraph').nth(1)
    await paragraph.scrollIntoViewIfNeeded()
    await paragraph.evaluate((el) => {
      const text = el.textContent ?? ''
      const start = text.indexOf('LLM-D')
      const node = el.firstChild
      if (!node || start < 0) return
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + 5)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await expect(page.locator('.highlight-toolbar')).toBeVisible()
    await page.locator('.highlight-toolbar button').filter({ hasText: 'Simplify' }).click()
    await expect(page.locator('.highlight-content h3')).toHaveText('LLM-D, simply.')
    await expect(page.locator('.highlight-content > p')).not.toContainText('scratch pad')

    await page.getByRole('tab', { name: 'Source' }).click()
    await expect(page.locator('.source-card__copy > span:first-child')).toContainText('LLM-D: distributed inference')
  })

  test('concept frames come from the video and play from their timestamp', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    const frame = page.locator('.video-frame').first()
    await expect(frame).toBeVisible()
    await expect(frame.locator('img')).toHaveAttribute('src', /\/frames\//)
    await expect(frame.locator('.video-frame__watch')).toContainText('Watch from')
    await frame.locator('.video-frame__button').click()
    await expect(page.locator('.video-player iframe')).toBeVisible()
    await expect(page.locator('.video-dialog')).toHaveCount(0)
    await page.locator('.video-inline__close').click()
    await expect(page.locator('.video-player iframe')).toHaveCount(0)
  })

  test('video plays in place and the highlights sidebar closes and reopens', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    await page.locator('.video-player__hit').click()
    await expect(page.locator('.video-player iframe')).toBeVisible()
    await expect(page.locator('.video-dialog')).toHaveCount(0)
    await expect(page.locator('.highlights-aside')).toBeVisible()

    await page.locator('.video-inline__close').click()
    await expect(page.locator('.video-player iframe')).toHaveCount(0)
    await expect(page.locator('.video-player__poster')).toBeVisible()

    await page.locator('.highlights-aside .panel-close').click()
    await expect(page.locator('.highlights-aside')).toHaveCount(0)
    await expect(page.locator('.highlights-toggle')).toBeVisible()
    const grid = await page.locator('.reader-shell').evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(grid.trim().split(/\s+/)).toHaveLength(2)

    await page.locator('.highlights-toggle').click()
    await expect(page.locator('.highlights-aside')).toBeVisible()
  })

  test('chapter navigation and keys page', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    await page.locator('.chapter-nav__button--next').click()
    await expect(page).toHaveURL(/chapter=batching/)
    await expect(page.getByRole('heading', { name: 'Batching trades latency for throughput.' })).toBeVisible()

    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Bring your own keys.' })).toBeVisible()
    await expect(page.getByLabel('API key').first()).toBeVisible()
    await expect(page.getByLabel('Model')).toHaveValue('deepseek-ai/DeepSeek-V4.1-Flash-1017')
    await expect(page.locator('input[type="password"]')).toHaveCount(2)
  })

  test('keys page fits in a desktop viewport without scrolling', async ({ page }) => {
    await page.goto('/settings')
    const fits = await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight + 1,
    )
    expect(fits).toBe(true)

    const gaps = await page.locator('.switch').evaluate((el) => {
      const track = el.getBoundingClientRect()
      const thumb = el.querySelector('.switch__thumb')?.getBoundingClientRect()
      if (!thumb) return null
      return {
        top: Math.round(thumb.top - track.top),
        bottom: Math.round(track.bottom - thumb.bottom),
      }
    })
    expect(gaps?.top).toBe(gaps?.bottom)
  })

  test('keys pad never reveals a stored key', async ({ page }) => {
    await page.goto('/settings')
    const inputs = page.locator('.key-field input')
    await expect(inputs.first()).toHaveValue('')
    await expect(inputs.first()).toHaveAttribute('type', 'password')
  })
})

test.describe('mobile', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  test('home and reader have no horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.mobile-tabs')).toBeVisible()
    const homeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(homeOverflow).toBe(false)

    await page.locator('.or-try__button').click()
    await expect(page).toHaveURL(/\/read\/ai-infrastructure/)
    await expect(page.locator('.reader-mobile-bar')).toBeVisible()
    const readerOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(readerOverflow).toBe(false)
  })

  test('mobile video plays in place and leaves the reader usable', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    await page.locator('.video-player__hit').click()
    await expect(page.locator('.video-player iframe')).toBeVisible()
    await expect(page.locator('.video-dialog')).toHaveCount(0)
    await expect(page.locator('.reader-mobile-bar')).toBeVisible()
    await page.locator('.video-inline__close').click()
    await expect(page.locator('.video-player iframe')).toHaveCount(0)
  })

  test('mobile sheet, source sheet, and read view', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    await page.locator('.reader-mobile-bar').click()
    await expect(page.locator('.highlights-sheet')).toBeVisible()
    await page.locator('.highlights-sheet .recent-highlight').first().click()
    await expect(page.locator('.highlights-sheet .highlight-content h3')).toHaveText(
      "The model's scratch pad.",
    )

    await page.locator('.highlights-sheet').getByRole('tab', { name: 'Source' }).click()
    await page.locator('.highlights-sheet .source-card').click()
    await expect(page.locator('.source-dialog--mobile')).toBeVisible()
    await expect(page.locator('.source-dialog__title')).toHaveText('Prefix caching')
    await page.locator('.source-dialog__close').click()
    await expect(page.locator('.source-dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Read view' }).click()
    await expect(page.locator('.read-highlights-fab')).toBeVisible()
    await expect(page.locator('.reader-mobile-bar')).toHaveCount(0)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflow).toBe(false)
  })

  test('keys and library fit and use the right navigation', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Bring your own keys.' })).toBeVisible()
    await expect(page.locator('.mobile-tabs')).toHaveCount(0)
    const keysOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(keysOverflow).toBe(false)

    await page.goto('/library')
    await expect(page.locator('.mobile-tabs')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Everything you’ve read.' })).toBeVisible()
    const libraryOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(libraryOverflow).toBe(false)
  })

  test('small phone still fits the home and reader', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/')
    let overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflow).toBe(false)

    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflow).toBe(false)
  })
})

test.describe('tablet', () => {
  test.use({ viewport: { width: 800, height: 900 }, hasTouch: true })

  test('reader sheet matches the tablet breakpoint', async ({ page }) => {
    await page.goto('/read/ai-infrastructure?chapter=kv-cache')
    await expect(page.locator('.highlights-aside')).toBeHidden()
    await expect(page.locator('.reader-mobile-bar')).toBeVisible()
    await page.locator('.reader-mobile-bar').click()
    await expect(page.locator('.highlights-sheet')).toBeVisible()
    await page.locator('.highlights-sheet .recent-highlight').first().click()
    await expect(page.locator('.highlights-sheet .highlight-content h3')).toHaveText(
      "The model's scratch pad.",
    )
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflow).toBe(false)
  })
})
