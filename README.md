# Meridian

Multi-plan learning campaigns: progress, spaced repetition, notes, themes, custom plan builder, and bring-your-own-key AI.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- Persistence via **IndexedDB** (`idb-keyval`) with **localStorage** fallback
- BYOK providers: Anthropic, OpenAI, Gemini, OpenRouter, Ollama
- Optional server fallback: `/api/claude` when Anthropic is selected and no browser key is set

## Setup

```bash
npm install
cp .env.example .env.local
```

```bash
# Optional server-side Anthropic fallback (when no BYOK key is pasted)
ANTHROPIC_API_KEY=sk-ant-...
```

Or open **AI** in the top bar and paste a provider key at runtime.

## Scripts

```bash
npm run dev
npm run build
npm start
npm run lint
npm test
```

## Features

- Built-in **365-day** and **45-day** plans, plus custom plans from the builder
- Plan generation (outline → periods), edit-before-save, cancel/resume
- Multi-plan switcher; delete purges that plan’s progress/notes/refs/srs
- **Other things I learned** — calendar journal with markdown notes, rich links, and AI insights
- Themes (8) via CSS custom properties — including Ledger (light) and Matte Black
- Export: notes markdown, full backup, **plan-only share**
- Import: plan share adds a plan; full backup asks **merge** or **replace**

## AI keys (BYOK)

- Default: key stays **in memory** only (cleared when the tab closes)
- Optional: “Remember this key on this device” → `dualtrack:credentials` in localStorage
- Exports never include credentials
- **Forget key** clears memory + storage

## Persistence

Storage keys keep the legacy `dualtrack:` prefix so existing local data still loads.

| Key | Contents |
|-----|----------|
| `dualtrack:meta` | schema version, active plan, theme |
| `dualtrack:plans` | plan definitions |
| `dualtrack:userdata` | progress, notes, refs, srs, log, learned |
| `dualtrack:credentials` | opt-in remembered provider key |

## Manual checklist

- Generate a 30-day plan with at least two providers
- Cancel generation midway, then resume
- Switch all eight themes on builder + progress screens (esp. Ledger & Matte)
- Reload: plans, progress, and theme survive; API key is gone unless “remember” was ticked
