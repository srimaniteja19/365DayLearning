# Refrainly

Multi-plan learning campaigns: progress, spaced repetition, notes, themes, custom plan builder, and bring-your-own-key AI.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- Persistence via **IndexedDB** (`idb-keyval`) with **localStorage** fallback
- Optional accounts + cloud sync: **Neon Postgres** (via Vercel's database integration) + **Auth.js v5** (credentials)
- BYOK via OpenRouter (paste your key + model in Settings)

## Setup

```bash
npm install
cp .env.example .env.local
```

Open **Settings** in the top bar and paste your OpenRouter key at runtime.

## Accounts + cloud sync (optional)

The app is fully usable with **no account** — everything lives in IndexedDB/localStorage on that
one device. Signing in adds sync: the entire snapshot (plans, progress, notes, SRS, and the
Learned journal) is mirrored to Postgres per account so it follows you across devices.

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
4. Run the app — a **Sign in** button appears in the top bar. Creating an account or signing in
   pulls any existing cloud snapshot for that account (or seeds the cloud with the current local
   data on first sign-in), then keeps pushing on every save.

Without `DATABASE_URL`/`AUTH_SECRET` set, the account button still renders but sign-in/sign-up
calls fail gracefully (503) and the app behaves exactly as it did before — purely local.

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

- New accounts start empty; **"OPERATION LONGHAUL"** (365-day) and **"OPERATION FASTBURN"** (45-day)
  are offered as opt-in example plans (added as-is, no AI needed) rather than auto-assigned
- Custom plans from the builder; plan generation (outline → periods), edit-before-save, cancel/resume
- Multi-plan switcher; delete purges that plan’s progress/notes/refs/srs
- **Other things I learned** — calendar journal with markdown notes, rich links, and AI insights
- Optional **accounts + cloud sync** (Neon Postgres + Auth.js) — sign in to sync across devices
- **Subscriptions** — Recruit (free OpenRouter BYOK) is live; Operator/Architect managed AI is planned (checkout not connected)
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

- Fresh browser/storage: app opens to the "Start your first campaign" example picker, not a plan
- Generate a 30-day plan with OpenRouter
- Cancel generation midway, then resume
- Switch all eight themes on builder + progress screens (esp. Ledger & Matte)
- Reload: plans, progress, and theme survive; API key is gone unless “remember” was ticked
