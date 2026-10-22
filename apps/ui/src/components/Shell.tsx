import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Grid2x2, Plus, Search } from 'lucide-react';
import { useApp } from '../store/app';
import { MODULES } from '../modules';
import { QuickAdd, SearchBar } from './Overlays';
import { Sheet } from './ui';
import { ReminderPrompt, ToastHost } from './Feedback';
import { TaskEditor } from './TaskEditor';

const BOTTOM = ['home', 'tasks', 'notes'];
const TAB_PATHS = ['/', '/tasks', '/notes'];

/** Steps back in the app's own history; falls back to Home when there is nothing to go back to. */
export function useGoBack() {
  const nav = useNavigate();
  return () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : nav('/'));
}

export function Shell() {
  const { openQuickAdd, openSearch, lock } = useApp();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const goBack = useGoBack();
  useEffect(() => setMore(false), [loc.pathname]);

  // Back arrow: on detail screens (a note, a lesson) everywhere; on the modules reached through "More" on phones.
  const hasHistory = !!(window.history.state as { idx?: number } | null)?.idx;
  const nested = /^\/(notes|lessons)\/./.test(loc.pathname) || loc.pathname.startsWith('/dev');
  const showBack = hasHistory && (nested || !TAB_PATHS.includes(loc.pathname));
  // An open note uses the whole phone screen: no bottom bar.
  const inNote = /^\/notes\/./.test(loc.pathname);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openQuickAdd(true); }
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd, openSearch]);

  // Lock after 5 minutes in background.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) lock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [lock]);

  const link = 'flex min-h-touch items-center gap-3 rounded-control px-3 text-body text-muted aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent';

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-sidebar-sm shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 md:flex lg:w-sidebar lg:p-3">
        <div className="mb-3 hidden px-3 pt-2 text-heading lg:block">Smritikosh</div>
        {MODULES.map((m) => (
          <NavLink key={m.key} to={m.path} end={m.path === '/'} className={link} title={m.label}>
            <m.icon size={20} className={m.color} aria-hidden />
            <span className="hidden lg:inline">{m.label}</span>
          </NavLink>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <div className={`mx-auto w-full max-w-content px-page-x pt-4 md:pb-8 ${inNote ? 'pb-8' : 'pb-24'}`}>
          <div className="mb-4 flex items-center justify-end gap-2">
            {showBack && (
              <button type="button" onClick={goBack} aria-label="Back"
                className={`mr-auto flex min-h-touch items-center gap-2 rounded-control px-3 text-body text-text hover:bg-surface-2 ${nested ? '' : 'md:hidden'}`}>
                <ArrowLeft size={20} aria-hidden />Back
              </button>
            )}
            <button type="button" onClick={() => openSearch(true)} aria-label="Search"
              className="flex min-h-touch items-center gap-2 rounded-control bg-surface-2 px-3 text-meta text-muted md:min-w-[220px]">
              <Search size={18} /><span className="hidden md:inline">Search</span><kbd className="num ml-auto hidden md:inline">Ctrl K</kbd>
            </button>
            <button type="button" onClick={() => openQuickAdd(true)}
              className="hidden min-h-touch items-center gap-2 rounded-control bg-accent px-4 text-body font-semibold text-on-accent md:flex">
              <Plus size={18} /> Add <kbd className="num text-meta opacity-80">Ctrl N</kbd>
            </button>
          </div>
          <Outlet />
        </div>
      </div>

      {!inNote && <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        {MODULES.filter((m) => BOTTOM.slice(0, 2).includes(m.key)).map((m) => (
          <NavLink key={m.key} to={m.path} end={m.path === '/'} className="flex min-h-touch flex-col items-center justify-center text-meta text-muted aria-[current=page]:text-accent">
            <m.icon size={22} aria-hidden />{m.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => openQuickAdd(true)} aria-label="Quick add"
          className="mx-auto -mt-6 flex h-14 min-h-0 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-float">
          <Plus size={26} />
        </button>
        {MODULES.filter((m) => m.key === 'notes').map((m) => (
          <NavLink key={m.key} to={m.path} className="flex min-h-touch flex-col items-center justify-center text-meta text-muted aria-[current=page]:text-accent">
            <m.icon size={22} aria-hidden />{m.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} className="flex min-h-touch flex-col items-center justify-center text-meta text-muted">
          <Grid2x2 size={22} aria-hidden />More
        </button>
      </nav>}

      <Sheet open={more} onClose={() => setMore(false)} label="More modules">
        <div className="grid grid-cols-3 gap-2">
          {MODULES.filter((m) => !BOTTOM.includes(m.key)).map((m) => (
            <NavLink key={m.key} to={m.path} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-card border border-border text-meta">
              <m.icon size={22} className={m.color} aria-hidden />{m.label}
            </NavLink>
          ))}
        </div>
      </Sheet>

      <QuickAdd />
      <TaskEditor />
      <ReminderPrompt />
      <ToastHost />
      <SearchBar />
    </div>
  );
}
