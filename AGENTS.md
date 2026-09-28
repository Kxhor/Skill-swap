# Skill Swap — Redesign Guardrails (read before every task in this repo)

## Absolute no-touch zone
- Everything under `backend/` is off-limits: no route changes, no model changes, no
  new endpoints, no migration changes, no changes to requirements.txt, render.yaml.
- Do not modify: frontend/src/lib/api.ts, frontend/src/context/AuthContext.tsx,
  frontend/src/context/SocketContext.tsx, frontend/src/hooks/useSwaps.ts,
  frontend/src/lib/types.ts, frontend/src/lib/constants.ts, vite.config.ts,
  package.json (dependencies), tsconfig*.json, vercel.json.
- Do not add new API calls, new fetch endpoints, new Socket.IO events, or new pages/
  routes. Every screen, field, and action that exists today must still exist and behave
  identically. This is a visual/structural pass only — component decomposition and
  className changes are fine; data flow, query keys, and business logic are not.
- Do not add new npm dependencies. Radix Toast and Radix Dialog are already installed
  and unused — use them instead of native alert()/window.confirm().
- There is no tailwind.config.js/ts in this repo. Tailwind v4 is configured CSS-first
  inside frontend/src/index.css under the `@theme` block. Extend tokens there, do not
  create a config file.

## Existing design tokens (extend, do not rename or delete)
--color-primary, --color-primary-dark, --color-primary-light, --color-secondary,
--color-accent, --color-success, --color-warning, --color-danger, --color-info,
--color-surface, --color-surface-alt, --color-border, --color-text, --color-text-muted,
--color-bg-card, --color-glass-main

## Known existing bugs to fix opportunistically wherever you touch the file (do not go
## hunting outside the files you're already editing in a given phase)
- frontend/src/pages/AdminDashboard.tsx: `<div className="w-full -alt rounded-full h-1.5 ml-5">`
  — truncated/broken class, likely meant `bg-surface-alt`.
- frontend/src/pages/Messages.tsx: `<div className="flex-1 flex flex-col -alt/30">`
  — same truncation bug, likely `bg-surface-alt/30`.
- frontend/src/pages/Settings.tsx: `<div className="flex items-center justify-between p-4  rounded-xl border border-border">`
  — double space where a background utility class is missing.
- frontend/src/components/SwapRequestModal.tsx: uses `bg-yellow-50 text-yellow-800
  border-yellow-200` — light-mode Tailwind classes in a dark-only app; also contains a
  stray `console.log("SwapRequestModal Rendered!"...)` debug statement — remove it.
- frontend/src/pages/Profile.tsx: `<div className="flex h-screen p-4 md:p-6 gap-6 p-6">`
  — duplicate/conflicting padding utilities on one element.
- Native `alert()` calls in ChatPanel.tsx (profanity error) and SwapRequestModal.tsx
  (success message), and `window.confirm()` in Settings.tsx (delete account) — replace
  with Radix Toast / Radix Dialog respectively. This changes presentation only, not the
  underlying request that fires.

## Verification requirement (every phase)
Before declaring a phase done, run `npm run build` in frontend/ and confirm zero
TypeScript errors. Do not silently work around a type error by using `any` — fix the
actual mismatch or ask.