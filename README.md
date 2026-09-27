# TaskFlow

A premium, local-first to-do app that adapts to how you actually work. Calm to look at, fast to use, and completely private — your data never leaves this browser.

## Highlights

- **Capture fast** — Quick Add in plain English: `report tomorrow 5pm #work p3`
- **Plan your day** — Today, Upcoming, Inbox, and a Dashboard with streaks and weekly rhythm
- **Focus mode** — Pomodoro, countdown and stopwatch sessions
- **Recurring tasks, reminders, subtasks, tags, priorities (P1–P4)**
- **Calendar** with drag-and-drop rescheduling
- **Search + filters**, keyboard-first (⌘K, `/`, `N`, `F`)
- **Made-for-you personalization** — pick your life context (Work / Student / Creator / Life) and TaskFlow shapes your starter workspace around it; choose your own accent color
- **Local-first & private** — works offline, exports to JSON/CSV anytime

## Stack

- React 18 + TypeScript + Vite
- Zustand (persisted) — data lives in `localStorage`
- Tailwind CSS with theme-aware design tokens (light / dark / system, six accents)
- Vitest + React Testing Library

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite
npm run build    # typecheck + production build to dist/
```

## Deploying

Static frontend only — output is `dist/`. Host anywhere: Vercel, Netlify, Cloudflare Pages, GitHub Pages. No server required.

> Note: TaskFlow is intentionally local-first. Data is stored per browser; cross-device sync would require adding an optional account backend.
