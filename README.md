<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/readme/dogear-lockup-dark.png">
  <img src="./public/readme/dogear-lockup-light.png" alt="Dogear" width="220">
</picture>

### Paste a video. Learn it.

A chaptered guide you can read at your level, search, and question.

<br>

![React](https://img.shields.io/badge/React-19-161616?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-161616?style=flat-square&logo=typescript&logoColor=3178C6)
![Vite](https://img.shields.io/badge/Vite-7-161616?style=flat-square&logo=vite&logoColor=646CFF)
![Node](https://img.shields.io/badge/Node-20%2B-161616?style=flat-square&logo=nodedotjs&logoColor=5FA04E)
![Nebius Token Factory](https://img.shields.io/badge/Nebius_Token_Factory-models-E9FF4F?style=flat-square&labelColor=161616)
![Tavily](https://img.shields.io/badge/Tavily-search-FAFAF7?style=flat-square&labelColor=161616)
![Playwright](https://img.shields.io/badge/Playwright-18_flows-161616?style=flat-square&logo=playwright&logoColor=2EAD33)
![Vitest](https://img.shields.io/badge/Vitest-23_tests-161616?style=flat-square&logo=vitest&logoColor=6E9F18)

<sub>Private preview · local-first · bring your own keys</sub>

</div>

---

Dogear turns long videos into a reading page. The video stays the source: every concept figure comes from the actual video and links back to the second it came from.

> The video is the source. The page is the guide.

## What makes it different

- **Real frames, not invented diagrams.** Concept figures are pulled from the video and play inline from their timestamp.
- **Highlights that keep up.** Select a sentence, then explain it, simplify it, see an example, or check the source. With a connected Nebius key, the chosen model answers for that passage; if it is offline, chapter-grounded local copy takes over.
- **Curate your list.** Remove recent highlights you no longer want. The change survives a reload.
- **Sources you can verify.** Tavily results open in a focused source view with the excerpt, key points, and original link.
- **Video where you need it.** Playback happens in place by default. Expand is there when you want the big screen.
- **Your keys, your machine.** Keys are stored in the macOS Keychain and never returned to the browser.
- **A library, not a transcript dump.** Compile a captioned video into chapters, keep your place, and return later.

## Quick start

```bash
git clone https://github.com/tonykipkemboi/dogear.git
cd dogear
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Use the built-in **AI Infrastructure Explained** guide to try the reader immediately, or paste a YouTube link to compile a new captioned video. For a new video, choose a reading level and a purpose before compiling; the connected Nebius model writes the guide from the transcript.

The seeded guide is built from [AI Infrastructure Explained](https://www.youtube.com/watch?v=hBzUokVYQkI) by KodeKloud.

### Requirements

- Node 20.19 or newer
- `yt-dlp` on your `PATH` for compiling new YouTube links
- A Nebius Token Factory key for live questions
- A Tavily key for live web research

## Keys

Dogear is bring-your-own-key. Open **Keys** from the header, the mobile tab bar, the reader header, or directly at [`/settings`](http://localhost:5173/settings) or `/keys` to add a Nebius Token Factory key and, optionally, a Tavily key.

On macOS, both are written to the Keychain through the local API. The browser only receives whether a key is configured. Stored keys cannot be revealed from the app. The server binds to `127.0.0.1` and never writes keys to logs or source files.

Environment variables are supported for self-hosting:

```bash
NEBIUS_API_KEY=...
TAVILY_API_KEY=...
```

## How it works

1. **Paste or compile.** Add a YouTube link, then choose your level and why you are watching. Dogear reads the captions and the connected model writes a chaptered guide with source timestamps.
2. **Read and highlight.** The page is the primary surface. Highlights and notes live beside it, not in a chat box.
3. **Pull the threads.** Ask for an explanation, check a claim against the web, or jump back to the exact moment in the video.

## Project map

```text
dogear/
├── src/                 React app, reader, highlights, mobile sheets
├── server/              Local API, Tavily search, Nebius Q&A, caption compiler
├── scripts/             macOS Keychain helper
├── public/frames/       Concept frames extracted from the source video
├── tests/               Playwright reader and mobile flows
└── data/library/        Compiled guides (gitignored)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API and Vite together |
| `npm run build` | Typecheck and build the production app |
| `npm start` | Serve the build and API from one process on port 8787 |
| `npm test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run browser flows with Playwright |
| `npm run typecheck` | Typecheck the app |
| `npm run lint` | Alias for the typecheck |

## Verification

- 23 unit tests
- 18 Playwright flows covering desktop, tablet, mobile, inline playback, sources, keys, and the sidebar
- Production build and deep links verified
- Live Tavily search verified

## Current limits

- New video compile supports YouTube links with English captions and requires a Nebius key. File upload and playlist compile are not wired yet.
- Live Q&A needs a valid Nebius Token Factory key. Without one, answers come from the current chapter.
- The demo source video stays on YouTube. The repo contains the thumbnail and concept frames, not the 730 MB source file.

---

<div align="center">
  <sub>Built with <a href="https://tokenfactory.nebius.com">Nebius Token Factory</a> and <a href="https://tavily.com">Tavily</a>.</sub>
</div>
