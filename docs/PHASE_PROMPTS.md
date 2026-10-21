Read CLAUDE.md and docs/PLAN.md. Start Phase 1: Foundation.
Set up the pnpm monorepo (packages/core, apps/ui, apps/desktop, apps/mobile).
Implement the schema v1 migrations from PLAN.md, the DataStore interface and both adapters,
seed default categories (Bank, Legal, Health, Skills, Office, Home, Personal).
Set up the design tokens, bundled fonts, light/dark themes and the shared components from the
UI design system in CLAUDE.md, with the /dev/components preview page.
Build the app shell: bottom nav on mobile / sidebar on desktop (Dashboard, Tasks, Notes, Lessons,
Wishlists, Stocks, Goals, Weekend, Vault, Settings), PIN lock screen, tags manager,
global search (Ctrl+K) and the quick-add sheet with the smart parser
("pay LIC premium tomorrow 6pm #bank !high").
Produce a working Windows installer and a debug Android APK, and document the exact build
commands in docs/PROGRESS.md. Show me your plan first.

---

Phase 2: Tasks + reminders + dashboard, per PLAN.md.
Task list grouped Overdue/Today/This week/Later/No date; filters; checklist items; repeat rules
(RRULE, next occurrence created on completion); free-time tag + "I have free time" view.
Notifier interface with Electron (Notification + tray, minimise to tray, auto-start option,
re-schedule on launch, "missed while closed" list) and Capacitor (local notifications, exact-alarm
permission flow, re-schedule on start). Notification actions: Done, Snooze 1h, Tomorrow 9am.
Dashboard v1: today's tasks, overdue count, next 7 days of reminders.
Add tests for repeat rules and grouping. Plan first.

---

Phase 3: Notes & Knowledge + Lessons Learned, per PLAN.md.
Subject -> Topic -> Note tree (parent_id), breadcrumb navigation, markdown editor with live preview
and code highlighting (bundled, no CDN), tags, pin, "Revise" flag with a revision list.
Lessons form (situation type, what happened, lesson, tags) and a "Before you start..." search.
Seed script that generates 500 sample notes to test search speed (< 200 ms). Plan first.

---

Phase 4: Wishlists + Weekend planner, per PLAN.md.
Wishlist tabs (Gifts, Festival, Perfumes, Movies & shows), status chips, optional price (INR) and link,
gifts grouped by person and occasion with totals.
Weekend: someday list, Friday 6pm notification (time configurable) suggesting 3 items weighted by
carryCount and age, plan-for-this-weekend action, Monday carry-over of unfinished items.
Unit-test the suggestion and carry-over logic. Plan first.

---

Phase 5: Stocks watchlist + Goals, per PLAN.md.
Watchlist: symbol, exchange (NSE/BSE), target buy, manual current price with quick bulk-update screen,
% distance to target, markdown analysis notes. Alert once when price <= target; reset when it rises above.
Create a PriceProvider interface with only a ManualProvider for now (no network code).
Goals with milestones as child items, auto progress, target date.
Dashboard: active goals with progress bars, stocks within 5% of target. Plan first.

---

Phase 6: Vault, backups, polish, per PLAN.md and the security rules in CLAUDE.md.
Vault: link-only entries by default; optional encrypted vault in vault.db (master password setup with
strength meter and a clear "no recovery" warning, unlock, auto-lock after 2 min idle or background,
reveal on tap, copy with 30-second clipboard clear). Write tests proving vault.db holds no plaintext.
Backups: daily automatic local backup (keep 7), manual export to a chosen folder as JSON and as a
password-encrypted file, import with preview and merge-or-replace.
Polish: dark mode, empty states, Android back button, app icons, fingerprint unlock.
Final: full test run, both release builds, update docs/PROGRESS.md. Plan first.