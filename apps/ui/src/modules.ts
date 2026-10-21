import { BookOpen, CheckCircle2, Gift, Lightbulb, Lock, Sun, Target, TrendingUp, Home, Settings, type LucideIcon } from 'lucide-react';
import type { ItemType } from '@smritikosh/core';

export interface ModuleDef {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Tailwind text/bg token class for the module dot/icon only */
  color: string;
  dot: string;
  type?: ItemType;
  emptyLine?: string;
  emptyAction?: string;
}

export const MODULES: ModuleDef[] = [
  { key: 'home', label: 'Home', path: '/', icon: Home, color: 'text-accent', dot: 'bg-accent' },
  { key: 'tasks', label: 'Tasks', path: '/tasks', icon: CheckCircle2, color: 'text-m-tasks', dot: 'bg-m-tasks', type: 'task', emptyLine: 'Tasks and reminders you need to act on go here.', emptyAction: 'Add your first task' },
  { key: 'notes', label: 'Notes', path: '/notes', icon: BookOpen, color: 'text-m-notes', dot: 'bg-m-notes', type: 'note', emptyLine: 'Subjects, topics and notes for learning and interview prep.', emptyAction: 'Add your first note' },
  { key: 'lessons', label: 'Lessons', path: '/lessons', icon: Lightbulb, color: 'text-m-lessons', dot: 'bg-m-lessons', type: 'lesson', emptyLine: 'Things life taught you, ready before the next similar situation.', emptyAction: 'Add your first lesson' },
  { key: 'wishlists', label: 'Wishlists', path: '/wishlists', icon: Gift, color: 'text-m-wishlists', dot: 'bg-m-wishlists', type: 'wish', emptyLine: 'Gifts, festival buys, perfumes, movies and shows.', emptyAction: 'Add your first wish' },
  { key: 'stocks', label: 'Stocks', path: '/stocks', icon: TrendingUp, color: 'text-m-stocks', dot: 'bg-m-stocks', type: 'stock', emptyLine: 'Stocks you are watching, with your target buy price.', emptyAction: 'Add your first stock' },
  { key: 'goals', label: 'Goals', path: '/goals', icon: Target, color: 'text-m-goals', dot: 'bg-m-goals', type: 'goal', emptyLine: 'Goals with milestones and a target date.', emptyAction: 'Add your first goal' },
  { key: 'weekend', label: 'Weekend', path: '/weekend', icon: Sun, color: 'text-m-weekend', dot: 'bg-m-weekend', type: 'weekend', emptyLine: 'A someday list for things to do on a free weekend.', emptyAction: 'Add your first idea' },
  { key: 'vault', label: 'Vault', path: '/vault', icon: Lock, color: 'text-m-vault', dot: 'bg-m-vault', type: 'vault_link' },
  { key: 'settings', label: 'Settings', path: '/settings', icon: Settings, color: 'text-muted', dot: 'bg-muted' },
];

export const moduleForType = (t: ItemType) => MODULES.find((m) => m.type === t)!;
