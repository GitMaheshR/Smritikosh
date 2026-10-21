import type { DataStore } from './datastore';
import type { Item } from './types';

// Small deterministic PRNG so the seed (and the perf test) is repeatable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const SUBJECTS: Record<string, string[]> = {
  'React': ['Hooks', 'State management', 'Performance', 'Testing'],
  'TypeScript': ['Generics', 'Utility types', 'Type narrowing'],
  'Databases': ['SQL joins', 'Indexing', 'Transactions', 'Normalisation'],
  'System design': ['Caching', 'Queues', 'Load balancing', 'Consistency'],
  'Node.js': ['Event loop', 'Streams', 'Clustering'],
  'Interview prep': ['Behavioural', 'Algorithms', 'Estimation'],
};
const WORDS = 'closure render effect memo reducer context index query lock cache shard retry latency throughput promise stream buffer thread pool schema migration pointer generic union mapped conditional recursion heap stack hash'.split(' ');
const CODE = [
  ['ts', 'const sum = <T extends number>(xs: T[]) => xs.reduce((a, b) => a + b, 0);'],
  ['sql', 'SELECT u.id, COUNT(o.id) FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id;'],
  ['js', 'useEffect(() => { const t = setTimeout(save, 500); return () => clearTimeout(t); }, [draft]);'],
  ['bash', 'git log --oneline --graph --all | head -20'],
] as const;

export interface SeedNote { subject: string; topic: string; title: string; body: string }

/** Deterministically generates `count` realistic notes spread across subjects and topics. */
export function generateSeedNotes(count: number, seed = 42): SeedNote[] {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const pairs = Object.entries(SUBJECTS).flatMap(([s, ts]) => ts.map((t) => [s, t] as const));
  return Array.from({ length: count }, (_, n) => {
    const [subject, topic] = pick(pairs);
    const w = () => pick(WORDS);
    const [lang, code] = pick(CODE);
    const sentence = () => `${w()} ${w()} ${w()} is ${w()} when the ${w()} ${w()} changes, so prefer a ${w()} over a ${w()}.`;
    return {
      subject, topic, title: `${topic}: ${w()} ${w()} #${n + 1}`,
      body: `## ${topic}\n\n${sentence()} ${sentence()}\n\n- ${sentence()}\n- ${sentence()}\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n${sentence()}`,
    };
  });
}

/** Creates the subject / topic / note tree for generated notes. Every row is flagged meta.seed so it can be removed. */
export async function seedNotes(store: DataStore, count = 500): Promise<number> {
  const subjects = new Map<string, Item>();
  const topics = new Map<string, Item>();
  for (const n of generateSeedNotes(count)) {
    let s = subjects.get(n.subject);
    if (!s) {
      s = await store.createItem({ type: 'note', title: n.subject, meta: { level: 'subject', seed: true } });
      subjects.set(n.subject, s);
    }
    const key = `${n.subject}/${n.topic}`;
    let t = topics.get(key);
    if (!t) {
      t = await store.createItem({ type: 'note', title: n.topic, parent_id: s.id, meta: { level: 'topic', seed: true } });
      topics.set(key, t);
    }
    await store.createItem({ type: 'note', title: n.title, body: n.body, parent_id: t.id, meta: { level: 'note', seed: true } });
  }
  return count;
}

export async function removeSeededNotes(store: DataStore): Promise<number> {
  const rows = (await store.listItems({ type: 'note' })).filter((i) => i.meta.seed === true);
  for (const i of rows) await store.deleteItem(i.id);
  return rows.length;
}
