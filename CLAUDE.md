# Memory Keeper — project rules

Personal, offline-only app for Windows and Android to track tasks, reminders, notes,
lessons learned, wishlists, a stock watchlist, goals, a weekend planner and a password vault.
Single user. Full plan, data model and UI spec: docs/PLAN.md — read it before starting any phase.

## Hard rules
- OFFLINE ONLY. No network calls at runtime, no CDN fonts/scripts, no analytics, no telemetry.
  Bundle every asset. The only future exception is an opt-in stock price refresh behind a provider interface.
- No backend server. Data lives in local SQLite on each device.
- Never store passwords, PINs or the vault master password in plain text or in logs.
- Vault data lives in a separate vault.db, encrypted with AES-256-GCM; key from PBKDF2-SHA256
  (600000 iterations, 16-byte random salt) via Web Crypto. Key held in memory only; wipe on lock.
- Vault contents are never indexed by search, never included in plain exports, never logged.

## Stack
- pnpm workspaces monorepo, TypeScript strict everywhere.
- packages/core: shared domain types, Zod schemas, SQL migrations, business logic
  (repeat rules, weekend suggestions, goal progress, quick-add parser, search index). No platform imports.
- apps/ui: React 18 + Vite + Tailwind + shadcn/ui + Zustand + React Hook Form + React Router (hash router).
- apps/desktop: Electron. better-sqlite3 in the MAIN process only; renderer talks via a typed
  contextBridge IPC API. contextIsolation on, nodeIntegration off, sandbox on. electron-builder -> NSIS installer.
- apps/mobile: Capacitor (Android). @capacitor-community/sqlite, @capacitor/local-notifications,
  @capacitor/filesystem, @capacitor/preferences, a biometric plugin for fingerprint unlock.
- A DataStore interface in core with two adapters (electron-ipc, capacitor-sqlite). UI code only
  ever uses DataStore and a Notifier interface — never platform APIs directly.
- Search: MiniSearch index built at startup, updated on every write.
- IDs: UUID v7. Dates: ISO 8601 strings, stored in local time with the timezone in settings (default Asia/Kolkata).
- Use current stable versions of all libraries; check docs if unsure rather than guessing APIs.

## UI design system — "Quiet notebook" (full spec in docs/PLAN.md, section UI design and typography)
- Original design. Do not copy the look of any existing app; no stock illustrations.
- Define ALL colours, fonts, sizes, radii and spacing as CSS variables in apps/ui/src/styles/tokens.css,
  mapped into tailwind.config. Components use tokens only — no raw hex or px values in components.
- Light and dark themes from the token table in PLAN.md; follow the system theme by default, override in Settings.
- Fonts bundled via @fontsource (no Google Fonts link):
  Plus Jakarta Sans 400/500/600/700 for the interface; Source Serif 4 400/600/italic for the optional
  note reading mode; JetBrains Mono 400/500 for code, prices, percentages (tabular figures).
- Type scale tokens: display 28/34 700, title 22/28 600, heading 17/24 600, body 15/22 400,
  meta 13/18 500, label 12/16 600 uppercase +0.04em, mono 13/20. Sizes in rem so system font size scales them.
- One accent (teal). Module colours only as dots and icons (Lucide icons, bundled).
  Overdue = burnt orange, never red. Borders instead of shadows; shadows only on floating elements.
- 4px spacing grid; card radius 12, inputs/buttons 10, chips full. Touch targets >= 44px.
  Visible 2px accent focus ring. Motion 150-200ms, disabled under prefers-reduced-motion.
- Phone (< 768px): bottom bar Home, Tasks, raised centre +, Notes, More. Windows (>= 768px): 240px
  sidebar collapsing to 72px; >= 1100px list + detail split. Quick-add is a bottom sheet on phone and a
  command bar on Windows (Ctrl+N); search uses the same bar (Ctrl+K).
- Build shared components first (ItemRow, Card, Chip, ProgressBar, EmptyState, Sheet, CommandBar)
  and add a hidden /dev/components page showing every component in both themes.
- Text contrast must meet WCAG AA in both themes.

## Quality bar
- Vitest unit tests for everything in packages/core; aim for coverage of all business rules.
- Each phase ends with: typecheck passes, lint passes, tests pass, both apps build.
- Mobile-first responsive UI (360px wide upward), keyboard shortcuts on desktop.
- Every list has an empty state, every destructive action has confirm or undo.
- Small commits with clear messages. Update docs/PROGRESS.md at the end of each phase:
  what was built, what is left, known issues, exact commands to build and run.

## Working style
- Before coding a phase, write a short plan and wait for my approval.
- Ask me when a requirement is unclear instead of inventing it.
- Do not start the next phase until I say so.
