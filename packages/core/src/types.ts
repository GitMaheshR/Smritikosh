import { z } from 'zod';

export const ITEM_TYPES = ['task', 'note', 'lesson', 'wish', 'stock', 'goal', 'weekend', 'place', 'vault_link'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ItemSchema = z.object({
  id: z.string(),
  type: z.enum(ITEM_TYPES),
  title: z.string().min(1),
  body: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  priority: z.number().int().min(1).max(3).default(2),
  status: z.string().nullable().default(null),
  due_at: z.string().nullable().default(null),
  remind_at: z.string().nullable().default(null),
  repeat_rule: z.string().nullable().default(null),
  parent_id: z.string().nullable().default(null),
  meta: z.record(z.unknown()).default({}),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});
export type Item = z.infer<typeof ItemSchema>;

export type NewItem = Pick<Item, 'type' | 'title'> &
  Partial<Omit<Item, 'id' | 'type' | 'title' | 'created_at' | 'updated_at'>>;

export interface Tag { id: string; name: string; color: string | null }
export interface Category { id: string; name: string; icon: string | null; sort: number }
export interface ChecklistEntry { id: string; item_id: string; text: string; done: boolean; sort: number }

export const DEFAULT_CATEGORIES = ['Bank', 'Legal', 'Health', 'Skills', 'Office', 'Home', 'Personal'] as const;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
