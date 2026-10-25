import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { applyTheme, useApp } from './store/app';
import { Shell } from './components/Shell';
import { LockScreen } from './components/LockScreen';
import { BackHandler } from './components/BackHandler';
import { LicenseGate } from './license/LicenseGate';
import { HomePage } from './pages/Home';
import { TasksPage } from './pages/Tasks';
import { TaskForm } from './pages/TaskForm';
import { NotesPage } from './pages/Notes';
import { JournalForm, JournalPage } from './pages/Journal';
import { GoalForm, GoalsPage } from './pages/Goals';
import { SettingsPage } from './pages/Settings';
import { DevSeed } from './pages/DevSeed';
import { DevComponents } from './pages/DevComponents';

export default function App() {
  return (
    <LicenseGate>
      <AppContent />
    </LicenseGate>
  );
}

function AppContent() {
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
          <Route index element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/new" element={<TaskForm />} />
          <Route path="/tasks/:id" element={<TaskForm />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:id" element={<NotesPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/journal/new" element={<JournalForm />} />
          <Route path="/journal/:id" element={<JournalForm />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/goals/new" element={<GoalForm />} />
          <Route path="/goals/:id" element={<GoalForm />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dev/seed" element={<DevSeed />} />
          <Route path="/dev/components" element={<DevComponents />} />
          <Route path="/lessons/*" element={<Navigate to="/journal" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
