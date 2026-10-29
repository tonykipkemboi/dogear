# Dogear Agent Guide

Dogear turns YouTube videos into chaptered learning guides. This file is for coding agents helping someone set up, run, debug, or extend the project.

## What This Repo Is

- `src/`: React 19 and Vite frontend. Home, reader, highlights, transcript, library, and keys.
- `server/index.mjs`: local Node API, Nebius calls, Tavily search, Keychain storage, and the guide compiler.
- `server/compile.mjs`: YouTube metadata, captions, transcript parsing, and transcript-only fallback guides.
- `src/data/example-modern-ai.json`: the shipped compiled example. It is available at `/read/yt-esq_bmxka4a`.
- `src/data/guide.ts`: shared guide types, design demo, and the compiled example import.
- `data/library/`: locally compiled guides. Gitignored. Delete a guide file to force a recompile.
- `public/`: brand assets, favicons, demo cover, and README logos.
- `tests/`: Playwright browser flows.

The design demo is still available at `/read/ai-infrastructure?chapter=kv-cache`. Home and Library open the latest compiled example.

## Prerequisites

- Node.js 20.19 or newer
- npm
- `yt-dlp` on `PATH` for new YouTube videos
- A Nebius Token Factory API key for compiling and live answers
- A Tavily API key for live web research
- Google Chrome for the Playwright suite, which uses the installed `chrome` channel

On macOS:

```bash
brew install yt-dlp
```

## First Setup

```bash
git clone https://github.com/tonykipkemboi/dogear.git
cd dogear
npm install
npm run dev
```

Open `http://localhost:5173`. The API starts on `http://127.0.0.1:8787` with the Vite proxy.

If port 8787 is already in use, stop the old process or run the API with a different `PORT`.

## Keys

Get keys here:

- Nebius Token Factory: <https://tokenfactory.nebius.com/project/api-keys>
- Tavily: <https://app.tavily.com/home>

Put them in the app under **Keys** or `/settings`.

- macOS stores them in Keychain as `dogear.nebius` and `dogear.tavily`.
- Other systems use `~/.config/dogear/keys.json`.
- Headless or self-hosted setups can use `NEBIUS_API_KEY` and `TAVILY_API_KEY`.
- The browser never receives a stored key. Do not print, log, commit, or paste keys into chat.
- The Nebius key is required. Tavily is optional; without it, source search falls back to saved demo sources.

Verify without exposing the value:

```bash
curl -s http://127.0.0.1:8787/api/keys/status
```

Run the UI key test after saving keys. A `401` from Nebius means the key is invalid or from the wrong project. A `401` from Tavily means the Tavily key is invalid.

## Run And Verify

```bash
npm run dev       # API and Vite together
npm run build     # Typecheck and production build
npm start         # Serve dist and API on port 8787
```

Health checks:

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/models
```

The built-in example should render without a key or network:

```text
http://127.0.0.1:8787/read/yt-esq_bmxka4a
```

The default model is `deepseek-ai/DeepSeek-V4.1-Flash-1017`. Override it with `DOGEAR_MODEL`.

## Verification

Use `npm run typecheck` and `npm run lint`. `npx run typecheck` is not valid because `npx` resolves packages, not npm scripts.

Run these before calling a change finished:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

`npm install` configures `.githooks/pre-commit`, which runs typecheck and lint on every commit. If hooks are not active, run `git config core.hooksPath .githooks`. Do not use `--no-verify`.

Current expected results:

- 24 unit tests
- 18 Playwright flows
- Production build succeeds
- Compiled example has 6 chapters, 5 diagrams, and 6 recall checks

`npm run test:e2e` starts the API and Vite if they are not already running. It needs Google Chrome. If Chrome is missing, install Chrome, or install Playwright's Chromium and update the Playwright config deliberately.

## Compiler And API Notes

- `POST /api/compile` accepts `{ url, level, purpose, model? }`.
- `GET /api/guides/:id` returns a compiled guide.
- `GET /api/transcript/:videoId` returns transcript cues for older guides.
- `POST /api/ask` handles explain, simplify, example, and follow-up questions.
- `POST /api/search` runs Tavily or returns saved sources.
- Compile flow: YouTube metadata, English captions, outline, chapter bodies, validation, cached guide.
- Direct original English captions are preferred over translated tracks. `yt-dlp` is the fallback.
- Compile output is cached by level, purpose, and `GUIDE_VERSION` in `server/index.mjs`.
- After changing the compile contract, bump `GUIDE_VERSION` or delete the affected `data/library/yt-*.json`.
- Compile completion uses 7000 tokens for the outline and 5000 per chapter body. Long videos can hit the model completion limit. Keep the retry and fallback behavior intact.
- The current limits are documented in README: English captions, local library, no accounts, no file upload, no playlist compilation.

Safe compile check:

```bash
curl -s -X POST http://127.0.0.1:8787/api/compile \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","level":"ELI15","purpose":"understand"}'
```

A successful response is `{"guideId":"yt-..."}`.

## Product Rules

- Highlight titles must quote the selected text exactly and lead with that quote.
- Explain what the selected term means. Use chapter context first, then general knowledge, and Tavily for short unfamiliar terms. Do not open with "the chapter does not define this".
- Keep answers short and useful. Do not turn a highlighted word into a full recap.
- Do not invent video frames, timestamps, sources, or quotes. Diagrams must be grounded in the transcript.
- Source actions should show evidence, not a model answer.
- Keep the public README and agent docs accurate. Do not claim every visual comes from the video.
- Preserve the existing visual system and responsive behavior unless the user asks for a redesign.

## Common Failures

- `YouTube is rate-limiting caption requests`: wait and retry. The compiler prefers the original English track; translated tracks can return 429 independently.
- `No English captions were found`: choose a video with English captions.
- `Nebius returned an empty guide (length)`: the completion budget is exhausted. Raise the budget only after confirming the model and transcript size.
- A guide looks stale: check `GUIDE_VERSION` and remove `data/library/yt-<id>.json`.
- `EADDRINUSE`: stop the process on 8787 or 5173.
- Empty or missing guide on a fresh clone: the compiled example is bundled in `src/data`; do not point Home at `data/library`, which is gitignored.
- E2E cannot launch Chrome: install Google Chrome, or adjust the Playwright `channel` intentionally.

## Handoff Checklist

1. Confirm `npm install` completed.
2. Confirm `yt-dlp --version` works if compiling new videos.
3. Open `/settings`, save both keys, and run the key tests.
4. Open the compiled example and the design demo.
5. Run typecheck, unit tests, Playwright, and the production build.
6. Do not commit keys, `data/library`, `dist`, test artifacts, or logs.
