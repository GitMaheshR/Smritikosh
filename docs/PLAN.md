# Memory Keeper App — Build Plan & Claude Code Prompts
 · 

## Overview and key decisions
Build one React + TypeScript app that runs fully offline: wrapped in Electron for Windows and Capacitor for Android, with all data in a local SQLite database on each device. No server, no cloud account, no internet needed for any core feature.
| 
Decision | 
Choice | 
Why | 
| 
UI | 
React 18 + TypeScript + Vite | 
One codebase for both platforms | 
| 
Styling / components | 
Tailwind CSS + shadcn/ui (Radix) | 
Fast to build, works offline, touch-friendly | 
| 
Windows shell | 
Electron (Node.js runs in its main process) | 
This is where your "Node.js" lives; gives tray, notifications, file system | 
| 
Android shell | 
Capacitor 6+ | 
Wraps the same React build as a native APK | 
| 
Database | 
SQLite (better-sqlite3 on Windows, @capacitor-community/sqlite on Android) | 
Real database, offline, same SQL schema on both | 
| 
Search | 
MiniSearch (in-memory full-text index) | 
Identical behaviour on both platforms, instant for personal-scale data | 
| 
Notifications | 
Electron Notification + tray on Windows; @capacitor/local-notifications on Android | 
Native reminders without internet | 
| 
Vault crypto | 
Web Crypto API: PBKDF2-SHA256 (600k iterations) + AES-256-GCM | 
Built into both runtimes, no extra crypto libraries | 
| 
State / forms | 
Zustand + React Hook Form + Zod | 
Small, predictable, validated input | 
Node.js runs on Windows only (inside Electron). Android has no Node runtime, so the app talks to the database through a small DataStore interface with two adapters. Business logic lives in shared TypeScript that runs in both places.

## What "no internet" means in practice
Four parts of your spec collide with offline-only; each has a decided workaround below, so Claude Code doesn't guess.
| 
Area | 
The catch | 
Plan | 
| 
Stock price alerts | 
Live prices need the internet | 
You type the current price (or update it in bulk); the app alerts when it crosses your target. Phase 5 adds an optional "refresh prices when online" button, off by default, behind a provider interface | 
| 
Windows ↔ Android sync | 
No cloud means the two devices don't share data automatically | 
Phase 6: encrypted export/import file (move via USB, pen drive or Bluetooth). Optional later: sync over home Wi-Fi (LAN only, no internet) | 
| 
Reminders on Windows | 
Electron can only notify while it is running | 
Start with Windows, minimise to tray instead of quitting, re-schedule all reminders on launch, show "missed while closed" on open | 
| 
Reminders on Android | 
Battery saver and Android 12+ exact-alarm rules can delay alarms | 
Request exact-alarm and notification permissions on first run; re-schedule on app start and after reboot | 
| 
Data loss | 
Phone lost or PC disk dies = data gone | 
Automatic daily local backup (last 7 kept) + manual export to a folder you choose | 
Google Play is not needed: you sideload the APK onto your own phone.

## Architecture
All screens and rules are written once; Windows and Android differ only in the adapter under the DataStore and Notifier interfaces, and each device keeps its own database files.

## Data model
Your universal-Item idea is right: one items table for everything, a JSON meta column for type-specific fields, and a few side tables. The vault lives in a separate database file. topic -> subject; milestone -> goal
  meta         TEXT DEFAULT '{}',       -- JSON, type-specific fields
  pinned       INTEGER DEFAULT 0,
  archived     INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT                     -- soft delete (trash, 30 days)
);
CREATE TABLE tags        (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, color TEXT);
CREATE TABLE item_tags   (item_id TEXT, tag_id TEXT, PRIMARY KEY (item_id, tag_id));
CREATE TABLE checklist   (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, text TEXT, done INTEGER DEFAULT 0, sort INTEGER);
CREATE TABLE categories  (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, icon TEXT, sort INTEGER);
CREATE TABLE settings    (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX idx_items_type_status ON items(type, status);
CREATE INDEX idx_items_due ON items(due_at);]]>
| 
Type | 
Status values | 
Fields in meta | 
| 
task | 
todo, in_progress, done, cancelled | 
freeTime (bool), estimateMins | 
| 
note | 
— | 
level: subject / topic / note (tree via parent_id) | 
| 
lesson | 
— | 
situation, whatHappened, lesson | 
| 
wish | 
wanted, bought, watched, dropped | 
kind (gift, festival, perfume, movie, show), person, occasion, price, link | 
| 
stock | 
watching, bought, dropped | 
symbol, exchange (NSE/BSE), targetBuy, lastPrice, lastPriceAt, alertFired | 
| 
goal | 
active, done, paused | 
progress (0–100, auto from milestones), targetDate; milestones = child items | 
| 
weekend | 
someday, planned, done | 
plannedFor (date), carryCount | 
| 
vault_link | 
— | 
manager ("Bitwarden"), entryName, hint (never the password) | 
Vault (separate file, vault.db): one row per entry with id, iv, ciphertext (AES-256-GCM of a JSON blob: site, username, password, notes). A vault_meta row stores the PBKDF2 salt, iteration count and an encrypted check value. The master password and the derived key are never written to disk; the key lives in memory only while unlocked and is wiped on auto-lock (2 minutes idle or app goes to background). No password recovery exists: forgetting the master password loses the vault, and the app says so at setup.

## Module specs
Each module is a filtered view over items, so global search, tags and quick-add work everywhere for free.
Quick-add (everywhere): floating + button and Ctrl+N on Windows. One text box with smart parsing: pay LIC premium tomorrow 6pm #bank !high → task, due tomorrow 18:00, category bank, priority high. A type switcher for the rest. Target: capture in under 5 seconds.
Global search: Ctrl+K / search icon. Searches title, body, tags and meta across all types, grouped by type, with filters (type, tag, category, status, date range). Vault contents are never indexed.
Tasks & Reminders: list grouped Overdue / Today / This week / Later / No date; filters by category, priority, free-time tag. Checklist items inside a task. Repeat rules (daily, weekly, monthly, yearly) for bills and renewals. Reminder actions: Done, Snooze 1h, Snooze to tomorrow 9am.
Free-time tag: a "I have free time" button that shows only freeTime tasks, shortest estimate first.
Notes & Knowledge: three-level tree Subject → Topic → Note; markdown editor with preview, code blocks with highlighting (for tech and interview prep), tags, pin, "Revise" toggle to mark notes for interview revision.
Lessons Learned: form with Situation type, What happened, Lesson, tags. A "Before you start…" search: type a situation (e.g. "negotiating salary") and see related lessons.
Wishlists: tabs Gifts / Festival / Perfumes / Movies & shows. Gifts grouped by person and occasion; optional price and link; total of wanted items per occasion.
Stocks Watchlist: symbol, exchange, target buy, current price (manual), distance to target in %, analysis notes in markdown. Alert fires once when lastPrice ≤ targetBuy, then resets if the price moves back above.
Goals: goal with milestones (child items); progress = done milestones ÷ total; target date.
Weekend Planner: "someday" list. Every Friday at 6pm (configurable) a notification suggests 3 activities (weighted toward items carried over most and never done); unfinished planned items roll back to someday with carryCount + 1.
Dashboard (home screen): today's tasks, overdue count, upcoming reminders (7 days), active goals with progress bars, this weekend's plan, stocks near target (within 5%).
Password Vault: default mode stores only links/hints ("Bank X is in Bitwarden"). The optional encrypted vault unlocks with a master password, auto-locks, hides values until tapped, copies to clipboard and clears it after 30 seconds, and is excluded from search and plain exports.
App lock: 4–6 digit PIN (stored as a PBKDF2 hash, never plain) on app open; fingerprint unlock on Android via a biometric plugin; lock after 5 minutes in background.
Settings: categories (add/rename/reorder), theme (light/dark/system), notification times, backup folder, export/import.

## UI design and typography
The direction is "Quiet notebook": warm paper-toned background, ink-dark text, one deep-teal accent, and module colours used only as small dots and icons. It should feel calm at 11 pm when you are capturing a stray thought, and show what needs you today before anything else.
Principles
Today first. Every screen opens on what is due or late; history and archives are one tap deeper.
Capture in 5 seconds. The + button sits in the same spot on every screen and opens a one-line quick-add.
One accent, used sparingly. Teal marks the primary action and progress; everything else is ink and grey.
Borders, not shadows. Flat cards with 1px borders; shadows only on things that float (sheets, the + button, menus).
Warm warnings. Overdue is burnt orange, not alarm red: it should nudge, not stress.
Same app, two densities. Phone is one column with a bottom bar; Windows adds a sidebar and a list + detail split.
On Windows the same cards sit in a two-column grid beside the sidebar; the order (today, overdue, goals, weekend, stocks near target) stays the same.

### Fonts
All three are free (SIL Open Font License) and bundled with the app through @fontsource packages, so nothing loads from the internet.
| 
Role | 
Font | 
Used for | 
| 
Interface | 
Plus Jakarta Sans (400, 500, 600, 700) | 
Everything by default: navigation, lists, forms, headings | 
| 
Reading | 
Source Serif 4 (400, 600, italic) | 
Optional reading mode for long notes and lessons; toggle in Settings | 
| 
Numbers and code | 
JetBrains Mono (400, 500) | 
Code blocks, stock prices, percentages, dates in tables (tabular figures keep columns aligned) | 
Fallback stack: "Plus Jakarta Sans", "Segoe UI", Roboto, "Noto Sans", sans-serif. Add Noto Sans Devanagari as a fallback if you will type Hindi or Marathi.

### Type scale
| 
Token | 
Size / line height (px) | 
Weight | 
Used for | 
| 
display | 
28 / 34 | 
700 | 
Dashboard greeting only | 
| 
title | 
22 / 28 | 
600 | 
Page titles ("Tasks", "Notes") | 
| 
heading | 
17 / 24 | 
600 | 
Card and section headings | 
| 
body | 
15 / 22 | 
400 | 
Item titles, note text, forms | 
| 
body-strong | 
15 / 22 | 
600 | 
Selected item, emphasised titles | 
| 
meta | 
13 / 18 | 
500 | 
Due dates, categories, counts | 
| 
label | 
12 / 16 | 
600, +0.04em tracking, uppercase | 
Section labels ("OVERDUE", "THIS WEEK") | 
| 
mono | 
13 / 20 | 
400 | 
Prices, %, code | 
Note text in reading mode uses Source Serif 4 at 17 / 28 with a 68-character max line width. Respect the system font-size setting (scale with rem).

### Colour tokens
| 
Token | 
Light | 
Dark | 
Use | 
| 
bg | 
#F6F4EF | 
#141619 | 
App background (warm paper / near-black) | 
| 
surface | 
#FFFFFF | 
#1C1F23 | 
Cards, sheets, inputs | 
| 
surface-2 | 
#EEEBE4 | 
#24282D | 
Hover, selected rows, search bar | 
| 
border | 
#E1DDD4 | 
#31363C | 
Card and input borders | 
| 
text | 
#1C2024 | 
#ECEDEF | 
Main text | 
| 
text-muted | 
#676C72 | 
#9BA1A8 | 
Meta text, placeholders | 
| 
accent | 
#0E7C72 | 
#34C3B3 | 
Primary buttons, + button, progress, links | 
| 
accent-soft | 
#DDF0EC | 
#17322F | 
Accent backgrounds (selected tab, chips) | 
| 
overdue | 
#C2531A | 
#F08A4B | 
Overdue items, high priority edge | 
| 
warning | 
#B7791F | 
#E0B04A | 
Due today, medium priority, stock near target | 
| 
success | 
#2F7D4F | 
#5CC08A | 
Done, bought, goal reached | 
All text/background pairs must pass WCAG AA contrast (4.5:1 for body text).

### Module colours (dots and icons only, never backgrounds)
| 
Module | 
Colour | 
Lucide icon | 
| 
Tasks | 
Teal #0E7C72 | 
check-circle-2 | 
| 
Notes | 
Indigo #4C51BF | 
book-open | 
| 
Lessons | 
Amber #B7791F | 
lightbulb | 
| 
Wishlists | 
Rose #C0386B | 
gift | 
| 
Stocks | 
Blue #2563A8 | 
trending-up | 
| 
Goals | 
Violet #7048C4 | 
target | 
| 
Weekend | 
Orange #D2691E | 
sun | 
| 
Vault | 
Slate #4A5563 | 
lock | 

### Layout and spacing
Spacing: 4px base; use 4, 8, 12, 16, 24, 32, 48. Page padding 16 on phone, 32 on desktop.
Corners: cards 12, inputs and buttons 10, chips fully rounded.
Phone (under 768px): single column; bottom bar with Home, Tasks, + (centre, raised), Notes, More; More opens a grid of the other modules.
Windows (768px and up): left sidebar 240px (collapses to 72px icons), content column max 760px; at 1100px and up, list on the left and the selected item's detail on the right.
Quick-add: bottom sheet on phone, centred command bar on Windows (Ctrl+N); search is the same bar with Ctrl+K.
Touch targets at least 44 × 44px; focus ring 2px accent with 2px offset for keyboard use.
Motion: 150–200ms ease-out for sheets and checkmarks; none when the system asks for reduced motion.

### Core components
Item row: round checkbox, title (body), one meta line (due chip, category dot, up to 2 tags); priority shown as a 3px left edge in overdue or warning colour. Swipe right = done, swipe left = snooze on phone; hover shows the same actions on Windows.
Card: surface, 1px border, 16 padding, heading + count on top, at most 5 rows then "See all".
Chip: 28px tall, rounded, meta text; filled with accent-soft when selected.
Progress bar: 6px tall, rounded, accent fill on surface-2 track, percentage beside it in mono.
Empty state: small module icon, one line saying what goes here, one button ("Add your first lesson"). No stock illustrations.
Vault entry: values shown as dots until tapped, mono font when revealed, copy button with a 30-second countdown.

## Build phases
Six phases, each ending in an app you can install and use. I moved "installable on both platforms" into Phase 1 so packaging problems surface on day one, not at the end.
| 
Phase | 
Delivers | 
Done when | 
| 
1. Foundation | 
Monorepo, Electron + Capacitor shells, SQLite on both, migrations, DataStore adapters, PIN lock, tags, categories, global search, quick-add, app shell with navigation | 
A Windows .exe and an Android .apk both install, survive restart with data intact, and work in airplane mode | 
| 
2. Tasks + Dashboard | 
Tasks with checklists, repeats, free-time tag, local notifications with snooze, dashboard v1 | 
A reminder set for 2 minutes ahead fires on both platforms with the app in background; repeating task creates its next occurrence on completion | 
| 
3. Notes + Lessons | 
Subject → Topic → Note tree, markdown editor + preview, Lessons form and situation search | 
500 seeded notes search in under 200 ms; markdown with code blocks renders correctly | 
| 
4. Wishlists + Weekend | 
Wishlist tabs with status, price, link; weekend someday list, Friday suggestions, carry-over | 
Friday notification suggests 3 items; unfinished items carry over on Monday | 
| 
5. Stocks + Goals | 
Watchlist with manual prices and target alerts; goals with milestones; dashboard widgets for both | 
Entering a price at or below target triggers one alert; goal progress updates when a milestone is ticked | 
| 
6. Vault, backup, polish | 
Link-only vault + optional encrypted vault, auto-backup, export/import (JSON + encrypted file), Windows tray + auto-start, dark mode, empty states | 
Export on Windows → import on Android restores everything; vault file contains no readable text; tests pass | 
Rough effort with Claude Code: Phase 1 is the hardest (two native shells and two database adapters); Phases 2–5 are mostly UI on the same foundation.

## Claude Code prompts
Use two layers: a CLAUDE.md file in the project root that Claude Code reads every session (the rules), plus one short prompt per phase (the work). Create an empty folder, save the first block as CLAUDE.md, also save this whole doc as docs/PLAN.md (export it as Markdown), then start Claude Code there.

### 1. CLAUDE.md (save in the project root) NSIS installer.
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
- Phone (= 768px): 240px
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
- Do not start the next phase until I say so.]]>

### 2. Phase prompts (paste one at a time)
Phase 1 — Foundation
Phase 2 — Tasks, reminders, dashboard
Phase 3 — Notes and Lessons Learned Topic -> Note tree (parent_id), breadcrumb navigation, markdown editor with live preview
and code highlighting (bundled, no CDN), tags, pin, "Revise" flag with a revision list.
Lessons form (situation type, what happened, lesson, tags) and a "Before you start..." search.
Seed script that generates 500 sample notes to test search speed (
Phase 4 — Wishlists and Weekend Planner
Phase 5 — Stocks and Goals
Phase 6 — Vault, backup, polish

## Working with Claude Code
Install first (Windows): Node.js LTS, pnpm, Git, Android Studio (gives the Android SDK and an emulator), and Visual Studio Build Tools with the C++ workload (needed to compile better-sqlite3).
One phase per session. Run /clear between phases; CLAUDE.md and docs/PROGRESS.md carry the context forward.
Approve the plan before code. The prompts ask for a plan first; push back on anything that adds a server or a network call.
Test on the real phone early. Enable USB debugging and install the APK in Phase 1; notification behaviour on emulators is not reliable.
Commit after every phase and tag it (git tag phase-1) so you can roll back if a later phase breaks something.
When something fails, paste the exact error and say which platform; ask it to fix the root cause and add a test that would have caught it.
Use the app from Phase 2 onward. Real use will tell you which later features matter; reorder Phases 3–5 freely.

## Schema v1

```sql
-- schema v1 (both platforms run the same migrations)
CREATE TABLE items (
  id           TEXT PRIMARY KEY,        -- UUID v7 (sortable, safe for future sync)
  type         TEXT NOT NULL,           -- task | note | lesson | wish | stock | goal | weekend | vault_link
  title        TEXT NOT NULL,
  body         TEXT,                    -- markdown
  category     TEXT,                    -- bank, legal, health, skills, office...
  priority     INTEGER DEFAULT 2,       -- 1 high, 2 medium, 3 low
  status       TEXT,                    -- per type, see below
  due_at       TEXT,                    -- ISO 8601 local datetime
  remind_at    TEXT,
  repeat_rule  TEXT,                    -- RRULE string, e.g. FREQ=MONTHLY;BYMONTHDAY=5
  parent_id    TEXT REFERENCES items(id), -- note -> topic -> subject; milestone -> goal
  meta         TEXT DEFAULT '{}',       -- JSON, type-specific fields
  pinned       INTEGER DEFAULT 0,
  archived     INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT                     -- soft delete (trash, 30 days)
);
CREATE TABLE tags        (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, color TEXT);
CREATE TABLE item_tags   (item_id TEXT, tag_id TEXT, PRIMARY KEY (item_id, tag_id));
CREATE TABLE checklist   (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, text TEXT, done INTEGER DEFAULT 0, sort INTEGER);
CREATE TABLE categories  (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, icon TEXT, sort INTEGER);
CREATE TABLE settings    (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX idx_items_type_status ON items(type, status);
CREATE INDEX idx_items_due ON items(due_at);
```
