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
  (repeat rules, notes and notebooks, goal progress, home stats, quick-add parser, search index). No platform imports.
- apps/ui: React 18 + Vite + Tailwind + shadcn/ui + Zustand + React Hook Form + React Router (hash router).
- apps/desktop: Electron. better-sqlite3 in the MAIN process only; renderer talks via a typed
  contextBridge IPC API. contextIsolation on, nodeIntegration off, sandbox on. electron-builder -> NSIS installer.
- apps/mobile: Capacitor (Android, and iPhone built in the cloud: see docs/IPHONE.md). @capacitor-community/sqlite, @capacitor/local-notifications,
  @capacitor/filesystem, @capacitor/preferences, a biometric plugin for fingerprint unlock.
- A DataStore interface in core with two adapters (electron-ipc, capacitor-sqlite). UI code only
  ever uses DataStore and a Notifier interface — never platform APIs directly.
- Search: MiniSearch index built at startup, updated on every write.
- IDs: UUID v7. Dates: ISO 8601 strings, stored in local time with the timezone in settings (default Asia/Kolkata).
- Use current stable versions of all libraries; check docs if unsure rather than guessing APIs.

## UI design system: "Daymark" (inspired by docs/design/daymark_ui_preview.html)
- Original work. Calm, friendly, uncluttered; no stock illustrations.
- Define ALL colours, fonts, sizes, radii and spacing as CSS variables in apps/ui/src/styles/tokens.css,
  mapped into tailwind.config. Components use tokens only: no raw hex or px values in components.
  Never override Tailwind's spacing scale (extend it), or classes like pl-10 silently stop working.
- Palette: indigo primary (#3547A6), teal secondary (#287D78), cool off-white background (#F6F7FB), ink text (#202538),
  white cards with 1px borders and almost no shadow. High / Medium / Low pills in warm red, amber and teal.
  Overdue is a warm red-orange. A dark theme is derived from the same palette; follow the system by default,
  override in Settings.
- Fonts bundled via @fontsource (no Google Fonts link): Inter 400-800 for the interface, JetBrains Mono for code and
  numbers, Source Serif 4 for the optional reading mode. Sizes in rem so the system font size scales them.
  Body 14px, meta 12px, eyebrow label 11px uppercase teal, page title 24-30px extra bold, stat numbers 28px.
- Radii: cards 20, tiles 16, controls 12, pills full. Touch targets >= 44px. Visible 3px focus ring.
  Motion ~160ms, disabled under prefers-reduced-motion.
- Layout: top bar (logo mark, name, tagline, search, + New). Sidebar card on >= 768px with Workspace (Home, Notes,
  Tasks, Journal) and Personal (Goals, Places, Settings) groups and an encouragement card. Phones: bottom bar Home, Tasks,
  raised +, Notes, More (every other section: Journal, Goals, Places, Settings). Detail screens and forms are full pages with a Back button
  (and Android Back); the bottom bar hides on them. Quick-add is a bottom sheet / command bar (Ctrl+N), search Ctrl+K.
- Every page: teal eyebrow, big title, one-line subtitle, primary action on the right.
- Shared components live in components/ui.tsx (PageHeader, Card, StatCard, Chip, PriorityPill, ProgressBar, Checkbox,
  TaskRow, EmptyState, FormRow, Sheet, CommandBar) and a hidden /dev/components page shows them in both themes.
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
