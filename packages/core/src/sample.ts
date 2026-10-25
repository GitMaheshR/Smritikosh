import type { DataStore } from './datastore';
import { lessonToItem } from './lessons';
import { toLocalIso } from './quickadd';
import type { Item, NewItem } from './types';

/** Local datetime `days` from `now` at hh:mm, as ISO 8601 local. */
function at(now: Date, days: number, h: number, m = 0): string {
  return toLocalIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m));
}

export const isSample = (i: Item) => i.meta.sample === true;

interface SampleTask extends Omit<NewItem, 'type' | 'meta'> {
  meta?: Record<string, unknown>;
  checklist?: string[];
}

function sampleTasks(now: Date): SampleTask[] {
  return [
    { title: 'Pay electricity bill', category: 'Home', priority: 1, due_at: at(now, -2, 18) },
    { title: 'Renew car insurance', category: 'Bank', priority: 1, due_at: at(now, -1, 12), checklist: ['Compare two quotes', 'Upload RC copy', 'Pay premium'] },
    { title: 'Book dentist check-up', category: 'Health', due_at: at(now, 0, 17), remind_at: at(now, 0, 16) },
    { title: 'Submit expense report', category: 'Office', priority: 1, due_at: at(now, 0, 15) },
    { title: 'Water the plants', category: 'Home', priority: 3, due_at: at(now, 0, 20), repeat_rule: 'FREQ=DAILY', meta: { freeTime: true, estimateMins: 10 } },
    { title: 'Pay LIC premium', category: 'Bank', priority: 1, due_at: at(now, 3, 18), remind_at: at(now, 3, 9), repeat_rule: 'FREQ=MONTHLY' },
    { title: 'Weekly review', category: 'Personal', due_at: at(now, 2, 18), repeat_rule: 'FREQ=WEEKLY;BYDAY=FR', checklist: ['Clear inbox', 'Plan next week', 'Review goals'] },
    { title: 'Prepare React interview questions', category: 'Skills', due_at: at(now, 2, 21), checklist: ['Hooks', 'State management', 'Performance', 'Testing'] },
    { title: 'Book tickets for the Diwali trip', category: 'Personal', due_at: at(now, 10, 10), remind_at: at(now, 9, 9) },
    { title: 'Read a chapter of Designing Data-Intensive Applications', category: 'Skills', priority: 3, meta: { freeTime: true, estimateMins: 30 } },
    { title: 'Tidy the desk', category: 'Home', priority: 3, meta: { freeTime: true, estimateMins: 15 } },
    { title: 'Sort old photos into albums', category: 'Personal', priority: 3, meta: { freeTime: true, estimateMins: 45 } },
    { title: 'File income tax return', category: 'Legal', priority: 1, status: 'done', due_at: at(now, -6, 12) },
  ];
}

/** Adds a small, realistic set of notes, tasks and lessons. Everything is flagged `meta.sample` so it can be removed. */
export async function loadSampleData(store: DataStore, now: Date = new Date()): Promise<{ tasks: number; notes: number; lessons: number; goals: number }> {
  if ((await store.listItems({ includeDeleted: false })).some((i) => isSample(i) && i.meta.sampleSet !== 'study')) return { tasks: 0, notes: 0, lessons: 0, goals: 0 };

  let tasks = 0, notes = 0, lessons = 0, goals = 0;

  for (const t of sampleTasks(now)) {
    const { checklist, meta, status, ...rest } = t;
    const it = await store.createItem({ type: 'task', status: status ?? 'todo', ...rest, meta: { sample: true, ...(meta ?? {}) } });
    for (const text of checklist ?? []) await store.addChecklist(it.id, text);
    tasks++;
  }

  // A note is just text; its first line is the title.
  const mk = async (title: string, body: string, o: { notebook?: string; pinned?: boolean; revise?: boolean } = {}) => {
    notes++;
    return store.createItem({
      type: 'note', title, body: `# ${title}

${body}`, pinned: o.pinned ?? false,
      meta: { sample: true, ...(o.notebook ? { notebook: o.notebook } : {}), ...(o.revise ? { revise: true } : {}) },
    });
  };

  await mk('useEffect cleanup', `An effect that starts something (a timer, a subscription, a listener) must stop it, or it leaks.

\`\`\`ts
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id); // runs before the next effect and on unmount
}, []);
\`\`\`

- Cleanup runs **before** the effect re-runs, not only on unmount
- Fetches: use an \`AbortController\` and abort in cleanup
- In React 18 dev mode effects run twice on purpose to expose missing cleanup
`, { notebook: 'Tech interviews', revise: true });
  await mk('Keys in lists', `Use a **stable id** as the key, not the array index, unless the list never reorders.

\`\`\`tsx
{items.map((i) => <Row key={i.id} item={i} />)}
\`\`\`

Index keys cause wrong state to stick to the wrong row after a reorder or delete.
`, { notebook: 'Tech interviews' });
  await mk('JOIN types at a glance', `| Join | Returns |
|---|---|
| INNER | rows with a match in both tables |
| LEFT | all left rows, matched right rows or NULL |
| FULL | all rows from both sides |

\`\`\`sql
SELECT u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.name;
\`\`\`
`, { notebook: 'Tech interviews' });
  await mk('When an index helps', `## Good candidates
- Columns in \`WHERE\`, \`JOIN\` and \`ORDER BY\`
- High-selectivity columns (many distinct values)

## Poor candidates
- Tiny tables
- Columns that are updated constantly
- Low-selectivity flags (e.g. \`is_active\`)

> Always check the query plan before and after: \`EXPLAIN\`.
`, { notebook: 'Tech interviews', pinned: true, revise: true });
  await mk('Caching strategies', `1. **Cache-aside**: app reads the cache first, loads from the DB on a miss, then fills the cache
2. **Write-through**: writes go to cache and DB together
3. **Write-behind**: write to cache, flush to the DB later (faster, riskier)

Invalidate on write, or set a TTL. *"There are only two hard things: cache invalidation and naming things."*
`, { notebook: 'Tech interviews', revise: true });
  await mk('Policy renewal checklist', `- [ ] Check the renewal date 30 days ahead
- [ ] Compare at least two quotes
- [ ] Re-confirm the sum insured and add-ons
- [x] Keep last year's policy PDF
`, { notebook: 'Money' });
  await mk('Gift ideas for Mom', 'Silk scarf, a good tea set, a framed family photo, the book she mentioned.');

  const L = async (situation: string, whatHappened: string, lesson: string) => {
    await store.createItem({ type: 'lesson', ...lessonToItem({ situation, whatHappened, lesson }), meta: { ...lessonToItem({ situation, whatHappened, lesson }).meta, sample: true } });
    lessons++;
  };
  await L('Negotiating salary', 'I accepted the first offer on the call without a counter.', 'Ask for a day to think, then counter once, politely, with a number.');
  await L('Lending money', 'Lent a friend a large amount; it took a year to get back part of it.', 'Only lend what you can afford to treat as a gift.');
  await L('Estimating work', 'Promised a feature in two days; it took six.', 'Take your first estimate and add half again, and say what is out of scope.');

  const goal = async (title: string, body: string, due_at: string, milestones: [string, boolean][]) => {
    const g = await store.createItem({ type: 'goal', title, body, status: 'active', due_at, meta: { sample: true } });
    for (const [i, [text, done]] of milestones.entries()) {
      await store.createItem({ type: 'goal', title: text, parent_id: g.id, status: done ? 'done' : 'todo', meta: { sample: true, milestone: true, order: i } });
    }
    goals++;
  };
  await goal('Build a consistent learning habit', 'Learn a little every day instead of in bursts.', at(now, 60, 0).slice(0, 10), [
    ['Pick one course or book', true], ['Block 30 minutes every morning', true], ['Finish the first module', true],
    ['Write a short summary of what I learned', false], ['Keep the streak for 30 days', false],
  ]);
  await goal('Organize personal documents', 'One folder, scanned copies, and a list of what expires when.', at(now, 21, 0).slice(0, 10), [
    ['List every document I need', true], ['Scan the originals', true], ['Name and file the scans', false],
    ['Note renewal dates in Tasks', false], ['Back up the folder', false], ['Share the list with family', false],
  ]);

  return { tasks, notes, lessons, goals };
}

/** Moves everything flagged as sample data (and the older 500-note seed) to the trash. */
export async function removeSampleData(store: DataStore): Promise<number> {
  const rows = (await store.listItems()).filter((i) => i.meta.sample === true || i.meta.seed === true);
  for (const i of rows) await store.deleteItem(i.id);
  return rows.length;
}
