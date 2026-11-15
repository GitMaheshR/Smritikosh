import { Home, ListChecks, MapPin, NotebookPen, PenLine, Settings, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Sidebar / More-menu groups, as in the Daymark layout. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { key: 'home', label: 'Home', path: '/', icon: Home },
      { key: 'notes', label: 'Notes', path: '/notes', icon: NotebookPen },
      { key: 'tasks', label: 'Tasks', path: '/tasks', icon: ListChecks },
      { key: 'journal', label: 'Journal', path: '/journal', icon: PenLine },
    ],
  },
  {
    label: 'Personal',
    items: [
      { key: 'goals', label: 'Goals', path: '/goals', icon: Target },
      { key: 'places', label: 'Places', path: '/places', icon: MapPin },
      { key: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
export const navItem = (key: string) => NAV.find((n) => n.key === key)!;
