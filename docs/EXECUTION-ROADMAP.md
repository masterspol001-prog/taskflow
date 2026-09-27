# TaskFlow — Execution-System Roadmap

Source: 803-line product review (visual 7.5/10, product 4/10). Keep the clean UI/Today hierarchy. Add intelligence + monetization behind it. Target: "turns goals into finished work."

## Where TaskFlow is today (gap check)

| Doc item | Status |
|---|---|
| Polished Today (greeting, progress, Focus, Coming up) | Done (TodayView) |
| Command palette / ⌘K quick add | Done (QuickAdd + shortcuts) |
| Keyboard shortcuts (N, /, T, U, I, Esc, Enter) | Mostly done |
| Recurring tasks, subtasks, priorities, tags, reminders | Done |
| Projects w/ sections, color coding | Done |
| Responsive + dark mode + empty states + onboarding | Done |
| Focus mode (Pomodoro/countdown/stopwatch) | Partial — no estimates, session stats |
| Task detail panel | Modal only — no right drawer |
| Calendar as planning engine (time blocks, drag/drop, estimates) | Not built |
| Goals, Routines/streaks, Weekly review | Not built |
| AI layer | Not built |
| Analytics dashboard (daily execution score, insights) | Basic dashboard only |
| Monetization (Free/Pro gates, billing) | Not built |

## Suggested build order

### Phase 1 — Make Today the command center (≈7 days)
- Daily execution score: "82 · Excellent" bar + Focus 92% / Completion 60% / Priority 88% + [View insights].
- Focus rows: add time estimate + priority line; [Start Focus] launches deep-work timer with Pause/Complete + session log.
- Task detail right-side drawer (keep context) — replace centered modal on desktop.
- Estimates on tasks (15m/30m/1h/2h) → enables "what can I do in 25 min".
- Command palette upgrade: `Plan my day`, `Start focus`, `Ask AI`, `Create goal`… beyond QuickAdd.

### Phase 2 — Retention layer (≈7–14 days)
- Goals (target date, progress %, linked projects, next milestone + next action).
- Routines (daily/weekday/weekly; completion streaks; auto-regenerate; Morning/Workout/Deep Work consistency).
- Calendar → execution calendar: tasks become time blocks, drag/drop scheduling, conflicts, recurring blocks, availability.
- Weekly review flow + productivity dashboard (week bars, top projects, AI-style insights).
- Intelligent reminders: "You have 45 min; these 2 overdue tasks fit now."

### Phase 3 — Monetization layer (≈14–21 days)
- Auth + accounts, subscription billing (Stripe/Razorpay), trial.
- Free / Pro / Team tiers per doc §16; paywall intelligence, not task basics.
- Pro gates: goals, advanced calendar, focus stats, AI, custom themes, integrations.
- Upgrade prompts + usage tracking.

### Phase 4 — AI moat (≈21–30 days)
- Natural-language capture + recurring parse in Inbox.
- AI Daily Planner (headline feature): auto-schedule high-impact first, accept plan, mid-day "18 min behind — move X → Thu 5:30" with Apply.
- AI breakdown, project planning, rescheduling, insights ("productive 9–11 AM").

## Kill list (do not build)
Random feature dumps · social feed · gamification overload · crypto · fake AI · excessive animation · 20 themes · chart-bomb dashboard · clone Notion/Todoist · team before personal retention · mobile before web monetization · free unlimited AI.

## North star
Free task management → users build history → see insights → AI planner becomes useful → hit a Pro gate → 7-day trial → pay. Compete on "intention to execution", never on being the cheapest todo app.

## Progress log (implementation tracking)

- [x] Phase 1: Today command center — right-side task detail drawer (center/drawer Modal variants), time estimates on tasks (15–120m, "25m/1.5h" labels), Focus button seeds the Focus overlay.
- [x] Phase 2 (core): Goals (Pro) — view, progress bars over linked projects, colors, delete; Routines (Pro) — recurring tasks grouped daily/weekly/monthly, one-click done rolls next occurrence.
- [x] Phase 3: Free/Pro model — `settings.plan`, Pro prompts, ₹299/₹499 paywall modal with free 7-day trial (local toggle), plan card in Settings.
- [x] Phase 4 (first slice): AI Day Planner (Pro) — deterministic local scheduling (no network/keys) by estimate/priority/deadline into 9–18h day, TIMED slots respected, Apply writes dueDate+dueTime.
- [x] Phase 2 tail: Weekly pulse on Calendar — 7-day completion chart, streak, and "most productive hour" insight for Pro; free sees an inline upsell teaser (`analytics.ts` + `WeekPulse`).
- [x] Phase 4 tail: real LLM planner — Pro users add their own OpenAI-compatible key/base URL/model in Settings → AI assistant (stored on-device only, never from env); Ask AI generates a JSON schedule over the model, clamped to 9–18h with clash avoidance, Apply still writes times. Falls back to the deterministic local scheduler when no key is set or the model call fails.
