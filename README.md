# Refrainly

Multi-plan learning campaigns for any subject: progress, spaced repetition, notes, themes, custom plan builder, and bring-your-own-key AI.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- Learning data persistence: **Neon Postgres** (Auth.js session required)
- BYOK via OpenRouter (paste your key + model in Settings)

## Setup

```bash
npm install
cp .env.example .env.local
```

Open **Settings** in the top bar and paste your OpenRouter key at runtime.

## Accounts + cloud sync

An account is **required** to use Refrainly (campaigns, Field Kit, progress). Sign-in loads and
saves the entire snapshot (plans, progress, notes, SRS, and the Learned journal) in Neon Postgres
per account so it follows you across devices.

1. **Create the database** — in the Vercel dashboard: *Storage → Create Database → Neon (Postgres)*.
   Connect it to this project so `DATABASE_URL` is added to your Vercel env vars automatically.
   For local dev, copy that same pooled connection string into `.env.local`.
2. **Generate an auth secret**:
   ```bash
   npx auth secret
   ```
   This writes `AUTH_SECRET` to `.env.local` (add it to your Vercel env vars too).
3. **Create the tables** (Drizzle ORM manages the schema in `lib/db/schema.ts`):
   ```bash
   npm run db:push
   ```
4. Run the app — create an account or sign in from the landing page or top bar. On sign-in the
   app pulls your cloud snapshot (or starts empty and seeds Neon on first save), then pushes on
   every change. Any leftover pre-Neon browser caches are cleared after a successful pull.

Without `DATABASE_URL`/`AUTH_SECRET` set, sign-in/sign-up calls fail gracefully (503) — auth must
be configured for the app to be usable beyond the landing page.

## Subscriptions

Three tiers, named after ranks from the XP ladder (`lib/xp.ts`) and defined in `lib/subscriptions.ts`:

| Tier | Price | Status | AI |
|------|-------|--------|----|
| **Recruit** (free) | $0 | **Live** | Bring your own OpenRouter key — unlimited plans + AI tools on your credits |
| **Operator** | $7/mo | Coming soon | Planned: managed AI with 3 plan generations + 150 AI actions / month |
| **Architect** | $12/mo | Coming soon | Planned: managed AI with 5 plan generations + 400 AI actions / month |

- **Today everyone uses Recruit behavior:** OpenRouter BYOK in Settings. Plan generation, quiz, notes, LinkedIn drafts, and journal insights all hit your key — no server quota.
- Paid tiers keep the planned quotas in code (`planGenerationsPerPeriod` / `aiActionsPerPeriod`) but `managedAi` is off, so those limits are not enforced until managed AI + checkout ship.
- Quota plumbing still lives in `lib/db/subscriptionQuota.ts` and `/api/claude` for when managed AI returns.
- **Checkout isn't wired up yet.** Upgrade buttons show “Coming soon.” `POST /api/subscription/upgrade` remains a 501 placeholder for a future payment processor.
- View plans from **Plans** in the top bar or landing nav, or **View plans & usage** in the account panel.

## Scripts

```bash
npm run dev
npm run build
npm start
npm run lint
npm test
npm run db:push      # push schema to DATABASE_URL (accounts/cloud sync)
npm run db:studio    # browse the database with Drizzle Studio
```

## Features

- New accounts start empty; example campaigns (**OPERATION MINDFIELD** 30-day psychology,
  **OPERATION LONGHAUL** 365-day systems, **OPERATION FASTBURN** 45-day AI) are opt-in
  (added as-is, no AI needed) rather than auto-assigned
- Custom plans from the builder; plan generation (outline → periods), edit-before-save, cancel/resume
- Multi-plan switcher; delete purges that plan’s progress/notes/refs/srs
- **Other things I learned** — calendar journal with markdown notes, rich links, and AI insights
- **Bookmarks** — save articles, YouTube/Vimeo, docs, and repos with compact link previews when available
- **Accounts + cloud sync** (Neon Postgres + Auth.js) — required to use the app; syncs across devices
- **Subscriptions** — Recruit (free OpenRouter BYOK) is live; Operator/Architect managed AI is planned (checkout not connected)
- Themes (10) via CSS custom properties for the **dashboard** — Signal, Folio, Afterburn, Chlorophyll, Oxide, Ion, Cinnabar, Halide, Voltaic, Marina. The **homepage** always uses a fixed **Briefing** skin (steel paper + electric blue + flare coral), independent of account theme.
- Export: notes markdown, full backup, **plan-only share**
- Import: plan share adds a plan; full backup asks **merge** or **replace**

## AI keys (BYOK)

- Default: key stays **in memory** only (cleared when the tab closes)
- Optional: “Remember this key on this device” → browser localStorage only (never written to Neon)
- Exports never include credentials
- **Forget key** clears memory + that local remember flag

## Persistence

Campaigns, progress, notes, SRS, Field Kit, theme, and font live in **Neon** (`user_state` via `/api/state`).
UI chrome (console layout, Field Kit filters, page) is session-only and is not persisted.
Optional BYOK “remember key” is the only intentional localStorage use.

## Manual checklist

- Fresh signed-in account: empty workspace + example plan picker (not an auto-assigned plan)
- Generate a 30-day plan with OpenRouter
- Cancel generation midway, then resume
- Switch all ten themes on builder + progress screens (esp. Afterburn & Voltaic)
- Reload while signed in: plans, progress, and theme come back from Neon; API key is gone unless “remember” was ticked
