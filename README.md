# DualTrack Console

Production Next.js app for the DualTrack learning console: a **365-day full-stack & systems campaign** plus a **45-day AI/LLM engineering sprint**, with progress tracking, spaced repetition, notes, themes, and optional Claude-powered study tools.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- Client-side state persisted in `localStorage`
- Anthropic Messages API proxied through `/api/claude` (API key stays on the server)

## Setup

```bash
npm install
cp .env.example .env.local
```

Set your key in `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# optional
# ANTHROPIC_MODEL=claude-sonnet-4-6
```

Notes / quiz / LinkedIn generation require the API key. Progress tracking, SRS, themes, and export/import work without it.

## Scripts

```bash
npm run dev      # http://localhost:3000 (Turbopack)
npm run build    # production build
npm start        # serve production build
npm run lint
```

## App structure

```
app/
  layout.tsx              # fonts, metadata, global CSS
  page.tsx                # DualTrack console
  dualtrack.css           # app styles
  api/claude/route.ts     # Anthropic proxy
components/dualtrack/
  DualTrackConsole.tsx    # full console UI + state
data/
  days-365.json           # main campaign curriculum
  days-45.json            # sprint curriculum
  domains.json            # domain labels
lib/
  types.ts
  storage.ts              # localStorage persistence
  claude-client.ts        # client → /api/claude
legacy/
  dualtrack-console.jsx   # original single-file source
```

## Persistence

State key: `dualtrack:state:v1`

```ts
{
  progress, notes, refs, srs, log, themeKey, updatedAt
}
```

Export/import uses backup format `version: 2` (`app: "dualtrack"`).

## Deploy

Deploy to Vercel (or any Node host):

1. Set `ANTHROPIC_API_KEY` in the host environment.
2. `npm run build` / platform build command: `next build`.
3. Start: `next start`.

Do not expose the Anthropic key to the browser.
