# Smritikosh — progress

## Logo and Java / database notes (2026-10-25)
- **Logo: "open book of memories"** (option 5 of `docs/design/logo-options.html`; the rendered 512px version is `docs/design/logo-512.png`).
  Drawn from scratch as a small SVG (two pages, faint text lines, three teal "spark" dots above). Used for: the header mark and lock screen
  (`LogoGlyph` / `BrandMark` in `components/ui.tsx`, themed through tokens including the new `--c-spark`), the browser favicon
  (`apps/ui/public/favicon.svg`), the Android launcher icons (legacy square, round and adaptive foreground, indigo background colour),
  the Windows installer and uninstaller icon, the app .exe icon, the window and taskbar icon, and the tray icon.
  Everything is regenerated with `apps/desktop/node_modules/.bin/electron scripts/make-icons.cjs` (renders the SVG with Electron, writes the
  PNGs, `apps/desktop/build/icon.ico` and `apps/desktop/src/trayIcon.ts`).
- The .exe icon is stamped by `apps/desktop/scripts/after-pack.cjs` using rcedit from electron-builder's cache, because electron-builder's own
  icon step is off ("signAndEditExecutable": false). If rcedit is not in the cache the step is skipped with a warning and the exe keeps Electron's icon.
- **Java and database study notes** (`packages/core/src/study.ts`, 11 notes with code and tables): Java collections, equals/hashCode,
  String/StringBuilder/StringBuffer, Streams and Optional, JVM memory and GC, JDBC and connection pools; ACID and isolation levels,
  indexes, normalisation, SQL joins, SQL interview queries. Categories "Java" (6) and "Databases" (5); four are flagged Review later.
  Settings > Sample data has its own button for them, independent of the everyday sample data, and "Remove sample data" removes both.
  Tests: 73 core (new: study notes).
- **Bug found on the phone and fixed:** with notifications refused by the system, scheduling a reminder threw "Notifications not enabled on this
  device" and the uncaught error stopped the app at "Opening Smritikosh…". Reminder scheduling failures are now caught: the app starts, and a
  "Reminders are switched off" notice shows on Home until scheduling works again (Settings > Reminders > Check permissions retries).
  After the fix the app started and the Oct 31 reminder alarm was confirmed scheduled.
- Checked: the logo in the header in the browser and on the phone; the installer icon and the app .exe icon extracted from the built files;
  study notes in the browser (Java code highlighted) and on the phone (11 added). Not looked at: the Android launcher icon on the phone's home
  screen, and the tray icon on screen.

## Categories instead of tags (2026-10-25)
Tags are gone from every screen; categories replace them, in two separate lists managed in Settings.
- **Task categories** (Settings > Task categories): the Category dropdown on the task form and the filter on the Tasks screen.
  Add, rename, delete, with a count of tasks using each. Deleting one keeps its tasks, just without a category.
- **Note categories** (Settings > Note categories): the former notebooks, now a Category dropdown in each note's ⋯ menu ("New
  category…" is there too) and the filter chips on the Notes screen. Separate list from task categories. Same add / rename / delete.
  Stored as before (`meta.notebook`, list in setting `notebooks`), so existing notes kept their category; the long names created by
  the old-tree migration ("Tech interviews / React") can be renamed in Settings.
- Removed: the Tags card in Settings, tag fields in the note menu and the journal form, `#tag` chips and counts everywhere. Quick-add
  `#word` is now a category only when it names a task category; otherwise it stays in the text. Sample data no longer creates tags.
  Tags already stored on old items are left in the database but not shown.
- Checked in the browser (add, duplicate blocked, rename, delete for both lists; setting a note's category) and on the phone
  (Settings lists). 69 core + 15 UI tests, typecheck, installer and APK build.
- Not done: reordering categories; the note's Category dropdown on the phone was not tapped through.

## Daymark redesign (2026-10-25)
The look and layout of the whole app were rebuilt from the Daymark prototype (`docs/design/daymark_ui_preview.html`),
because the earlier "Quiet notebook" design was not liked. Data, reminders, repeat rules, checklists, notes migration, the PIN
lock, Back handling and sample data are unchanged underneath.

### Design
- Tokens (`apps/ui/src/styles/tokens.css`): indigo primary, teal secondary, cool off-white background, Inter (bundled), 20px cards,
  tinted chips and High / Medium / Low pills; a dark theme derived from the same palette. Tailwind's spacing scale is no longer
  replaced (only extended), which removes the class of bug behind the earlier search-box overlap.
- Shell: top bar (logo mark, name, tagline, search, + New), sidebar card on >= 768px (Workspace: Home, Notes, Tasks, Journal.
  Personal: Goals, Settings, plus an encouragement card), phone bottom bar (Home, Tasks, +, Notes, More).
- Every page: teal eyebrow, big title, subtitle, action on the right. Forms are full pages with Back / Cancel.

### Screens
- **Home:** date eyebrow and headline, stat cards (open, due today, overdue), Today's focus with progress bar, Quick capture
  tiles, Recently captured, "missed while closed" banner.
- **Tasks:** search, filters (All, Today, Overdue, Upcoming, Free time, Completed), category select, grouped list with priority
  pills. Full-page task form with "More options" (reminder, repeat, estimate, free time, checklist).
- **Notes:** card library with notebook filter chips; note page keeps Read / Edit, checklists, menu.
- **Journal:** the former Lessons: "Before you start…" search, reflection cards, full-page entry form (`/journal`; `/lessons` redirects).
- **Goals (new):** goals with milestones, progress bars, target date and status; goal page with tick-able milestones.
  Core: `goals.ts` (progress, ordering, target-date labels), `home.ts` (stats, today's focus, recently captured).
- **Settings:** Appearance, Reminders, App lock, Categories, Tags, Sample data (now includes 2 goals), About.
- Wishlists, Weekend, Stocks and Vault are not in the menu (Daymark does not include them); their item types are untouched.

### Tests / builds
- 69 core tests (new: goals, home helpers, sample goals) and 15 UI tests. Typecheck, UI build, Windows installer and debug APK pass.
- Browser (phone and desktop sizes, light and dark): Home, Tasks, task form, Notes, a note, Journal, Goals, a goal (ticking a
  milestone moved progress 60% to 80%), Settings; completing a task updated the stat cards and progress bar and offered Undo;
  quick-add parsed "buy milk tomorrow 6pm !high" and created the task.

### On the phone (Moto G82 5G, 2026-10-25)
Installed over the old build with data kept (database backed up first). Checked by screenshot and taps, in the phone's dark theme:
Home (stat cards, focus list, bottom bar), Notes library (cards, notebook chips), a note in Read and Edit mode (formatting bar sits
above the keyboard), Tasks (filters, grouped list, priority pills), quick-add sheet above the keyboard, More menu, Goals, Journal list
and entry form. **Android Back works:** from a note it returns to the library, it closes the More sheet and the quick-add sheet first,
and it leaves the app only after stepping back through every earlier screen (4 presses in the test).
- Found and fixed on the phone: "Updated 22 oct" (month in lowercase); now "Updated Oct 22", with only "today" / "yesterday" lowercase.

### Not verified
- Search overlay, reminder prompt, PIN lock screen and the light theme in the new style were not looked at on the phone.
- The phone shows older sample data and two goals typed in earlier; new goals sample data needs a remove-and-add of sample data.
- Sample data already on a device has no goals; use Settings > Remove sample data, then Add sample data again.
- Windows installer built, not run. Export and backup (Phase 6) still to do.

## Notes redesign + Back button (2026-10-22, after Phase 3)
Notes felt too complex (Subject → Topic → Note, many controls). Replaced with notebooks and tags (plan "B").

### Notes
- **List:** search box, chips (All, each notebook with count, No notebook, Review later, + Notebook), rows with title,
  one-line snippet and date, pinned first then most recently edited. Rename / delete a notebook (its notes are kept).
- **New note** opens a blank page; the first line is the title. A note left blank is discarded (also cleaned at startup).
- **Editor:** one text box (auto-growing), Read / Edit switch, formatting bar (bold, heading, list, checklist, code) shown
  in Edit mode, a single Enter is a new line, checklist lines (`- [ ]`) are tappable in Read mode, autosave 600 ms and on
  leaving. **⋯ menu:** Pin, Review later (+ Mark as reviewed), Notebook (pick or create), Tags, Delete with Undo.
- **Storage:** same `items` table. Notebook = `meta.notebook`; saved notebook list = setting `notebooks`.
- **Migration** (`runNotesMigration`, once, flag `notes_v2`): topic → notebook "Subject / Topic", notes directly under a
  subject use the subject's name, old title becomes the first line (`# Title`), old Subject/Topic rows go to the trash.
  Idempotent (also skips notes already marked `migrated`).
- Sample data and the 500-note seed now use notebooks and tags.

### Back button
- Visible **← Back** on detail screens (an open note or lesson) and, on phones, on modules reached through More.
- **Android Back / gesture:** closes the open sheet first, else goes back a screen, else leaves the app
  (`@capacitor/app`). Closing a lesson replaces its history entry so Back does not reopen it.
- While a note is open on a phone the bottom tab bar is hidden to give the text room.

### Tests / builds
- 58 core tests (title/snippet, filters, notebooks, migration incl. idempotency, sample data, seed + 500-note search
  speed) and 15 UI tests (markdown safety, line breaks, checkbox rendering and toggling incl. fenced code). Typecheck,
  UI build, Windows installer and debug APK all pass.
- Browser (phone-size): sample data → list and chips, open a note, tap a checkbox, ⋯ menu, Back, New note, type, checklist
  button, Back → new note listed. Found and fixed: React dev double-mount deleted a fresh blank note.
- **Phone (Moto G82 5G):** update installed with data kept; the app database was read back off the phone and confirms the
  migration ran (`notes_v2 = 1`, old containers trashed, notes carry notebooks, e.g. "Tech interviews / React", titles kept).
  A pre-update backup of the phone database is in the session scratchpad.

### Fix: search box text overlapped the search icon
The Tailwind spacing scale (`tokens.css` / `tailwind.config.cjs`) had no steps 5, 7, 9, 10, 14, 16 or 24, so classes such
as `pl-10`, `h-7` (chips), `h-14 w-14` (the + button), `h-5 w-5` (checkboxes) and `pb-24` (space above the bottom bar)
were silently ignored. Added those steps (all multiples of 4 px). Checked in the browser (search padding 40 px, chips 28 px)
and on the phone (search icon clear of the text, + button 56 px).

### Not verified
- **Touch use of the new Notes screen and Android Back on the phone:** seen on the phone by screenshot (Notes list after the
  migration, search bar), but not tapped through. The phone was locked when the update was first installed.
- Formatting bar and keyboard interaction on the phone; wide-screen list + editor layout was seen only partly.
- The Windows installer was built but not run.
- Enter on a list line does not continue the list yet.

## Phase 3 — Notes and Lessons (built 2026-10-22)
*(The Subject / Topic / Note tree described below was replaced by the redesign above.)*

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

### Device test: Moto G82 5G, Android, USB (2026-10-22)
Debug APK installed over USB and driven with taps.
- **Worked:** app starts; SQLite initialises and seeds the 7 categories; created Subject → Topic → Note with correct
  breadcrumb; code-block toolbar button inserts a fence; Preview renders and highlights code (`const` coloured);
  edit survived backgrounding and a cold start (confirmed by reading the app's database off the phone); data survived a
  reinstall (`install -r`); the soft keyboard opens and the nav bar stays above it; quick-add `lesson:` opens the
  pre-filled lesson form; situation suggestions show as a native dropdown.
- **Bug found and fixed:** the note editor textarea rendered about two lines tall (`min-h-touch` beat `min-h-[320px]`,
  also visible in the browser earlier). Fixed with `!min-h-[320px]`; confirmed tall on the phone.
- **Found, not fixed (Phase 6 per plan):** the Android Back button is not handled, so Back from a screen exits the app
  to the home screen instead of going to the previous screen.
- **Not tested on the phone:** search speed with 500 notes (the `#/dev/seed` page has no link and the app has no URL
  bar), Reading mode, Pin / Revise / Move, delete + Undo, "Before you start…" results, reminders from Phase 2.

### Sample data (added after Phase 3)
Settings → "Sample data" → Add / Remove. Loads 13 tasks (overdue, today, this week, later, no date, repeating,
free-time with estimates, with checklists, one already done), 13 notes (two subjects, topics, markdown with code and
tables, 3 flagged for revision, 1 pinned, 1 loose) and 3 lessons. Everything is flagged `meta.sample`; Remove moves only
those rows to the trash. Three sample tasks have real reminders set for the next days. Code: `packages/core/src/sample.ts`
(6 tests). Verified in the browser and on the Moto G82 5G (Tasks screen).

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
