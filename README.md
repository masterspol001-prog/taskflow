# TaskFlow

A local-first to-do app: Capture · Focus · Finish. Data lives in this browser (`localStorage`). There is no account backend and no cloud sync.

## Run locally

```bash
npm install
npm run dev
```

```bash
npm test
npm run typecheck
npm run build
```

Production output is static files in `dist/`. Preview with `npm run preview`.

## Deploy

Host `dist/` on any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, nginx). No server is required.

- **Vercel**: this repo includes `vercel.json` (SPA fallback to `index.html`, cache headers). Connect the repo or upload the build.
- **Other hosts**: configure a single-page fallback so unknown paths serve `index.html`. In-app navigation uses hash routes (`#/today`), so most hosts work even without extra rewrites.
- Do not commit `.env`, license private keys, or `scripts/keys/`.

## Environment variables

All are optional and baked in at **build** time (`VITE_*`). Copy `.env.example` to `.env` only on the machine that builds.

| Variable | Purpose |
|---|---|
| `VITE_CHECKOUT_MONTHLY_URL` | https payment link for monthly Pro |
| `VITE_CHECKOUT_ANNUAL_URL` | https payment link for annual Pro |
| `VITE_CHECKOUT_LIFETIME_URL` | https payment link for lifetime Pro |
| `VITE_SUPPORT_EMAIL` | Contact shown in Settings / legal pages |
| `VITE_SITE_ORIGIN` | Public origin for sitemap / share metadata |

Checkout URLs can also be set in Settings on the device. Empty values mean checkout is not configured. Optional LLM keys are entered in Settings and stay on-device; they are never read from the agent environment.

Selling Pro (license keys, signing pair) is documented in `docs/MONETIZATION.md`.

## What works

Today, Inbox, Upcoming, Plan, Goals, Insights, Calendar, Board, Projects, Routines, Review, Rewards, Search, Focus, themes, Settings, import/export (JSON/CSV), ICS, PWA install for this origin.

Rule-based ranking and day planning are **smart suggestions**, not a cloud AI. Optional “Plan with AI” only runs if you paste your own OpenAI-compatible key in Settings.

## Limitations (honest)

- **Local-first only.** Tasks never leave the browser unless you export or you send an AI request to *your* endpoint. Clearing site data, another browser, or another device does not see this data. There is no multi-user or cloud sync.
- **FEATURES_UNLOCKED is currently `true`.** Free caps and the paywall UI are in the code but not enforced. Flip `FEATURES_UNLOCKED` in `src/lib/pro.ts` to restore license/trial gates. License redeem still works.
- **Checkout is opt-in.** Without `VITE_CHECKOUT_*` or Settings links, Subscribe does nothing useful.
- **Notifications** need browser permission and an open (or installed PWA) tab; they are not a server push.
- **Service worker** caches this origin only. It is not a full offline backend.

## Stack

React 18, TypeScript, Vite, Zustand persist, Tailwind, Vitest.
