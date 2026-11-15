import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Grid2x2, Plus, Search } from 'lucide-react';
import { useApp } from '../store/app';
import { NAV_GROUPS, navItem } from '../modules';
import { BackHandler } from './BackHandler';
import { QuickAdd, SearchBar } from './Overlays';
import { BrandMark, Sheet } from './ui';
import { ReminderPrompt, ToastHost } from './Feedback';

const TAB_PATHS = ['/', '/tasks', '/notes'];
const TAGLINE = 'Your personal space to think, plan, and grow';

/** Steps back in the app's own history; falls back to Home when there is nothing to go back to. */
export function useGoBack() {
  const nav = useNavigate();
  return () => ((window.history.state as { idx?: number } | null)?.idx ? nav(-1) : nav('/'));
}

export function Shell() {
  const { openQuickAdd, openSearch, lock } = useApp();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const goBack = useGoBack();
  useEffect(() => setMore(false), [loc.pathname]);

  // Back arrow on detail screens everywhere, and on screens reached through "More" on phones.
  const hasHistory = !!(window.history.state as { idx?: number } | null)?.idx;
  const nested = /^\/(notes|tasks|journal|goals)\/./.test(loc.pathname) || loc.pathname.startsWith('/dev');
  const showBack = hasHistory && (nested || !TAB_PATHS.includes(loc.pathname));
  // A note, task form or goal uses the whole phone screen: no bottom bar.
  const fullScreen = /^\/(notes|tasks|journal|goals)\/./.test(loc.pathname);

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

  const sideLink = 'flex min-h-touch items-center gap-3 rounded-control px-3 text-body font-medium text-muted hover:bg-surface-2 aria-[current=page]:bg-primary-soft aria-[current=page]:font-bold aria-[current=page]:text-primary';
  const tab = 'flex min-h-touch flex-col items-center justify-center gap-0.5 text-meta font-semibold text-muted aria-[current=page]:text-primary';
  const home = navItem('home'), tasks = navItem('tasks'), notes = navItem('notes');

  return (
    <div className="mx-auto min-h-screen w-full max-w-shell px-page-x pt-4 md:pt-6">
      <BackHandler />
      <header className="mb-4 flex items-center justify-between gap-3 md:mb-6">
        <div className="flex min-w-0 items-center gap-3">
          {showBack && (
            <button type="button" onClick={goBack} aria-label="Back"
              className={`-ml-2 flex min-h-touch items-center gap-1 rounded-control px-2 text-body font-bold text-text hover:bg-surface-2 ${nested ? '' : 'md:hidden'}`}>
              <ArrowLeft size={20} aria-hidden />Back
            </button>
          )}
          <div className={`flex min-w-0 items-center gap-3 ${showBack ? `${nested ? 'md:flex' : ''} hidden md:flex` : ''}`}>
            <BrandMark />
            <div className="min-w-0">
              <p className="text-title leading-6">Smritikosh</p>
              <p className="hidden truncate text-meta text-muted sm:block">{TAGLINE}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openSearch(true)} aria-label="Search" className="btn !px-3">
            <Search size={18} aria-hidden /><kbd className="num hidden text-meta font-medium text-faint md:inline">Ctrl K</kbd>
          </button>
          <button type="button" onClick={() => openQuickAdd(true)} className="btn btn-primary hidden md:inline-flex">
            <Plus size={18} aria-hidden />New<kbd className="num text-meta font-medium opacity-80">Ctrl N</kbd>
          </button>
        </div>
      </header>

      <div className="md:grid md:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] md:gap-6">
        <aside className="hidden md:block" aria-label="Main navigation">
          <div className="sticky top-6 rounded-card border border-border bg-surface p-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="mb-2">
                <div className="px-3 pb-1 pt-2 text-label uppercase text-faint">{g.label}</div>
                {g.items.map((n) => (
                  <NavLink key={n.key} to={n.path} end={n.path === '/'} className={sideLink}>
                    <n.icon size={18} aria-hidden />{n.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="mt-4 rounded-tile bg-secondary-soft p-4">
              <strong className="text-body text-text">A little progress counts.</strong>
              <p className="mb-3 mt-1 text-meta text-muted">Keep your next step small and your plans visible.</p>
              <NavLink to="/tasks" className="btn !min-h-9 !px-3 text-meta">View my tasks →</NavLink>
            </div>
          </div>
        </aside>

        <main className={`min-w-0 ${fullScreen ? 'pb-8' : 'pb-28'} md:pb-10`}>
          <Outlet />
        </main>
      </div>

      {!fullScreen && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
          <NavLink to={home.path} end className={tab}><home.icon size={22} aria-hidden />{home.label}</NavLink>
          <NavLink to={tasks.path} className={tab}><tasks.icon size={22} aria-hidden />{tasks.label}</NavLink>
          <button type="button" onClick={() => openQuickAdd(true)} aria-label="Quick add"
            className="mx-auto -mt-6 flex h-14 min-h-0 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-float">
            <Plus size={26} aria-hidden />
          </button>
          <NavLink to={notes.path} className={tab}><notes.icon size={22} aria-hidden />{notes.label}</NavLink>
          <button type="button" onClick={() => setMore(true)} className={tab}><Grid2x2 size={22} aria-hidden />More</button>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} label="More">
        <div className="grid grid-cols-3 gap-3">
          {['journal', 'goals', 'settings'].map((k) => {
            const n = navItem(k);
            return (
              <button key={k} type="button" onClick={() => { setMore(false); nav(n.path); }}
                className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-tile border border-border text-meta font-bold">
                <span className="grid h-9 w-9 place-items-center rounded-control bg-primary-soft text-primary"><n.icon size={18} aria-hidden /></span>{n.label}
              </button>
            );
          })}
        </div>
      </Sheet>

      <QuickAdd />
      <ReminderPrompt />
      <ToastHost />
      <SearchBar />
    </div>
  );
}
