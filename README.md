# TaskFlow

A premium, local-first to-do app that turns goals into finished work. Calm to look at, fast to use, and private by default — your data lives in this browser.

## Highlights

- **Capture fast** — Quick Add in plain English: `report tomorrow 5pm #work p3`
- **Plan your day** — Today command center with an execution score, Focus / Completion / Priority, and “Start Focus”
- **AI operating layer** — `/plan` builds a day, next-action, auto-reschedule, mid-day adapt, morning briefing
- **Focus mode** — Pomodoro, countdown, stopwatch, session stats and log
- **Calendar** — month / week / day time blocks, drag-and-drop, ICS import/export, conflict rings
- **Goal planning system** — 5-year → today horizons, goal hierarchy, health, templates, Plan with AI, goals on Today, deadlines on Calendar, weekly/monthly reviews, analytics
- **Routines, Waiting** — streaks/templates, blocked queue
- **Search + commands** — `/` for `/plan` `/focus` `/ask` `/goal` `/add` `/energy`
- **Local-first Pro** — 7-day trial, license keys, optional user-supplied LLM key (never from the agent env)
- **PWA** — installable, works offline from this browser’s store

## Stack

- React 18 + TypeScript + Vite
- Zustand (persisted) — data lives in `localStorage`
- Tailwind CSS with theme-aware design tokens (light / dark / system, six accents)
- Vitest + React Testing Library

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Run the test suite
npm test

# Typecheck + production build to dist/
npm run build
```

## Deploying

Static frontend only — output is `dist/`. Host anywhere: Vercel, Netlify, Cloudflare Pages, GitHub Pages. No server required.

Pro checkout defaults to Razorpay: https://razorpay.me/@prathameshpraveenkulkarni (overridable in Settings). Optional OpenAI-compatible API keys stay on-device and are only sent when you click Plan with AI.

> Note: TaskFlow is local-first. Cross-device sync would require an optional account backend. If you set an AI key, that request leaves the browser to your chosen endpoint.
