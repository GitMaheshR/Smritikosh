import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { applyTheme, useApp } from './store/app';
import { Shell } from './components/Shell';
import { LockScreen } from './components/LockScreen';
import { BackHandler } from './components/BackHandler';
import { Dashboard, ModulePage, VaultPage } from './pages/Pages';
import { TasksPage } from './pages/Tasks';
import { NotesPage } from './pages/Notes';
import { LessonsPage } from './pages/Lessons';
import { DevSeed } from './pages/DevSeed';
import { SettingsPage } from './pages/Settings';
import { DevComponents } from './pages/DevComponents';
import { MODULES } from './modules';

export default function App() {
  const { ready, locked, boot, theme } = useApp();
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => theme === 'system' && applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);

  if (!ready) return <div className="p-8 text-muted">Opening Smritikosh…</div>;
  if (locked) return <LockScreen />;

  return (
    <HashRouter>
      <BackHandler />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          {MODULES.filter((m) => m.type && m.key !== 'vault' && m.key !== 'tasks' && m.key !== 'notes' && m.key !== 'lessons').map((m) => (
            <Route key={m.key} path={m.path} element={<ModulePage />} />
          ))}
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:id" element={<NotesPage />} />
          <Route path="/lessons" element={<LessonsPage />} />
          <Route path="/lessons/:id" element={<LessonsPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dev/seed" element={<DevSeed />} />
          <Route path="/dev/components" element={<DevComponents />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
