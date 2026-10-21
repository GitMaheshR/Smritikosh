# Smritikosh — progress

## Phase 3 — Notes and Lessons (built 2026-10-22)

### Built
- **core**: note tree helpers (`childrenOf`, `breadcrumb`, `descendants`, `buildTree`, `canMove`, `moveTargets`,
  `reviseList`), lessons (`LessonIndex` with situation-weighted "Before you start…" search, `lessonToItem`,
  `situationOptions`), deterministic seed generator and remover. 44 tests (14 new), incl. cycle protection,
  cascade delete/restore and search timing.
- **Markdown** (`apps/ui/src/markdown.ts`): `marked` + trimmed bundled `highlight.js` (JS/TS, SQL, Python, Java, C#,
  bash, JSON, YAML, HTML/CSS, aliases) + `DOMPurify`. 8 jsdom tests incl. hostile input (scripts, event handlers,
  `javascript:` links, remote images, iframes, forms, svg).
- **Notes**: Subject → Topic → Note drill-down with breadcrumb (phone) and list + editor split (wide screens);
  create at each level, pin, "Revise" flag + "Mark revised" + "To revise" list, move-to picker, tags, delete with
  undo (a subject or topic takes its contents with it and Undo restores them together). Editor: textarea with
  bold / heading / list / code-block toolbar, live preview (side by side on wide, Edit/Preview toggle on phone),
  autosave 600 ms after the last keystroke, and a flush when leaving the note. Loose notes (from quick-add) show at
  the root.
- **Lessons**: form (situation with suggestions + free typing, what happened, lesson, tags), list, and a
  "Before you start…" box that ranks lessons by situation match.
- **Wiring**: quick-add `note:` opens the new note, `lesson:` opens the lesson form pre-filled; global search results
  open the exact note, lesson or task; Settings has a Reading mode toggle (Source Serif 4, 17/28, 68ch); hidden
  `#/dev/seed` page adds / times / removes 500 sample notes.

### Measured
- 500 seeded notes, Node: index build 96 ms, slowest of 5 searches 3.8 ms (limit 200 ms).
- 500 seeded notes, in the browser pane: slowest of 4 searches 1.9 ms over 527 items.

### Deviations / limits
- Markdown links are inert (shown underlined, not clickable) because this app is offline and a WebView navigating
  away would be worse than a dead link. Remote images are removed; `data:image` images are kept.
- Notes are kept only at subject / topic / note depth; a note cannot be nested under a note.
- The search index is rebuilt in full on each refresh. Fast at this size; if a device is slow at several thousand
  notes, move it to incremental updates or a worker.
- Still no ESLint.

### Verified
- Typecheck, 44 core tests + 8 UI tests, UI build, Windows installer, debug APK, Electron run (no console errors).
- In the browser: drilled Subject → Topic → Note, markdown + code highlighting render, no horizontal overflow;
  created a lesson and "Before you start…" returned it.

### Not verified
- Android device: search speed with 500 notes, editor on the phone keyboard, autosave on app backgrounding.
- Dark-mode appearance of highlighted code was not inspected visually.
- Wide-screen (>= 1100 px) list + editor layout was not inspected visually (the browser pane is phone-width).
- The Windows installer was built but not installed and run.

## Phase 2 — Tasks, reminders, dashboard (built 2026-10-22)

### Built
- **core**: RRULE subset (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, BYDAY, BYMONTHDAY; month ends and leap day clamp),
  `completeTask` (creates the next occurrence on completion, skipping to a future date if long overdue, keeping
  reminder offset, tags, meta), task grouping (Overdue / Today / This week / Later / No date), filters, free-time
  ordering (shortest estimate first), snooze times, pending / missed / upcoming reminder logic, checklist methods on
  `DataStore` (SQL + memory). 30 tests pass (19 new).
- **Notifier** (`Notifier` interface in core; UI only uses that):
  - Windows: scheduler ticker in the Electron main process, native notifications, tray icon, close hides to tray,
    "Start with Windows" option (starts hidden), single-instance lock, re-schedule on launch.
  - Android: `@capacitor/local-notifications` adapter with Done / Snooze 1h / Tomorrow 9am actions, notification and
    exact-alarm permission flow, manifest permissions incl. boot receiver, re-schedule on app start.
  - Browser dev: timer-based, so the in-app prompt can be tried at `pnpm dev:ui`.
- **UI**: Tasks page (grouped list, category / priority / "I have free time" filters, completed list), task editor
  (due, reminder, priority, category, repeat, estimate, free-time, notes, checklist), in-app reminder prompt, undo
  toasts for done and delete, dashboard v1 (missed-while-closed banner, overdue, today, next 7 days), reminders card
  in Settings.

### Deviations / limits
- **Windows notification buttons:** Electron supports notification action buttons on macOS only. On Windows, clicking
  the toast opens the app, which shows the Done / Snooze prompt. Android has real action buttons.
- Reminders only fire while the app process runs (tray). Quitting from the tray menu stops them until next launch,
  when anything that came due shows under "Missed while closed".
- Android caps scheduling at 60 reminders at once; the rest are added on later launches.
- Swipe gestures on rows not built (not in the Phase 2 scope).
- ESLint still not set up.

### Verified
- Core tests, typecheck, UI build, Electron run (no console errors), Windows installer and debug APK all build.
- In the browser: a reminder set ~1 minute ahead fired the prompt; Done on a daily task created the next day's task.

### Not verified
- **No device or emulator test of Android reminders** (background firing, exact alarms, after reboot, action buttons).
- **Windows toast firing with the window hidden in the tray** has not been observed on screen; the installed .exe was not run.

## Phase 1 — Foundation (built 2026-10-22)

### Built
- pnpm monorepo: `packages/core`, `apps/ui`, `apps/desktop` (Electron), `apps/mobile` (Capacitor Android).
- **core**: Zod item types, schema v1 migrations, `DataStore`/`Notifier` interfaces, one shared `SqlStore`
  (runs on any `SqlDriver`), `MemoryStore` (tests / browser dev), UUID v7, PIN hashing (PBKDF2-SHA256, 600k),
  quick-add parser, MiniSearch index. 11 Vitest tests.
- **ui**: "Quiet notebook" tokens (`src/styles/tokens.css` → Tailwind), bundled fonts, light/dark/system theme,
  shared components (ItemRow, Card, Chip, ProgressBar, EmptyState, Sheet, CommandBar), hidden `#/dev/components`,
  app shell (bottom bar on phone, sidebar on desktop), quick-add (Ctrl+N), global search (Ctrl+K), PIN lock screen
  (locks after 5 min in background), settings with categories + tags managers, module pages with empty states.
- **desktop**: Electron, SQLite in main process via IPC (contextIsolation on, nodeIntegration off, sandbox on).
- **mobile**: Capacitor 6 Android project; `@capacitor-community/sqlite` adapter in `apps/ui/src/platform`.

### Deviations from PLAN.md
- Windows SQLite uses **`node:sqlite`** (built into Electron 37's Node 22) instead of `better-sqlite3`, because
  this machine has no Visual Studio C++ Build Tools. The `SqlStore` code is unchanged; swapping drivers later is
  one function in `apps/desktop/src/main.ts`. `node:sqlite` is flagged experimental in Node.
- shadcn/ui was not added; components are hand-written on Tailwind tokens.
- Installer is unsigned and has no custom icon yet (`signAndEditExecutable: false`, needed because
  electron-builder cannot extract its signing tools without Windows symlink privilege).

### Not done / not verified
- **Android APK has not been run on a device or emulator.** The capacitor-sqlite adapter is untested.
- Fingerprint unlock (biometric plugin) — deferred to Phase 6 per plan.
- Windows installer built but not installed/run; Electron dev run was checked (DB created, schema + categories seeded).
- No lint config yet.

### Commands
```bash
pnpm install
pnpm test                 # core unit tests
pnpm typecheck
pnpm dev:ui               # browser dev, in-memory data
pnpm dev:desktop          # build UI + run in Electron
pnpm dist:desktop         # -> apps/desktop/release/Smritikosh Setup 0.1.0.exe
pnpm apk:debug            # -> apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```
Android needs `apps/mobile/android/local.properties` with `sdk.dir=C:/Users/Dell/AppData/Local/Android/Sdk`.
Data: Windows `%APPDATA%\Smritikosh\smritikosh.db`.
