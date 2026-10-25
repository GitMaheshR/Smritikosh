import type { DataStore } from './datastore';

/** Java and database revision notes that ship as removable sample data (Settings > Sample data). */
export interface StudyNote {
  title: string;
  category: 'Java' | 'Databases';
  /** shows up under "Review later" */
  revise?: boolean;
  body: string;
}

// In the text below ¤ stands for a backtick, so the notes can live in template literals. It is swapped in at load time.
const raw: StudyNote[] = [
  {
    title: 'Java collections: which one to use',
    category: 'Java',
    body: `Pick the collection by how you will use it, then code against the interface (¤List¤, ¤Map¤), not the class.

| Need | Use | Good to know |
|---|---|---|
| Ordered list, fast access by index | ¤ArrayList¤ | O(1) get, O(n) insert or remove in the middle |
| Queue or stack | ¤ArrayDeque¤ | Usually faster than ¤LinkedList¤ |
| Unique items, no order | ¤HashSet¤ | O(1) average add and contains |
| Unique items, sorted | ¤TreeSet¤ | O(log n); needs ¤Comparable¤ or a ¤Comparator¤ |
| Key to value | ¤HashMap¤ | O(1) average; one ¤null¤ key allowed |
| Key to value, keep insertion order | ¤LinkedHashMap¤ | Handy for simple LRU caches |
| Key to value, sorted by key | ¤TreeMap¤ | O(log n) |
| Thread-safe map | ¤ConcurrentHashMap¤ | No ¤null¤ keys or values |

¤¤¤java
Map<String, Integer> counts = new HashMap<>();
for (String word : words) {
    counts.merge(word, 1, Integer::sum);   // counts each word
}
¤¤¤

## Remember
- ¤List.of(...)¤ and ¤Map.of(...)¤ are immutable; ¤Arrays.asList(...)¤ is fixed-size.
- Changing a list while looping over it throws ¤ConcurrentModificationException¤. Use an ¤Iterator¤ or ¤removeIf¤.
- ¤HashMap¤ keys should be immutable and must implement ¤equals¤ and ¤hashCode¤ properly.
`,
  },
  {
    title: 'equals() and hashCode() contract',
    category: 'Java',
    revise: true,
    body: `**The contract**
1. If ¤a.equals(b)¤ is true, then ¤a.hashCode() == b.hashCode()¤ must be true.
2. ¤equals¤ must be reflexive, symmetric, transitive and consistent.
3. Equal hash codes do **not** mean equal objects (collisions are normal).

If you override one, override both. ¤HashMap¤ and ¤HashSet¤ use ¤hashCode¤ to pick a bucket, then ¤equals¤ to find the match.

¤¤¤java
public final class Point {
    private final int x, y;

    public Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Point)) return false;
        Point p = (Point) o;
        return x == p.x && y == p.y;
    }

    @Override
    public int hashCode() { return java.util.Objects.hash(x, y); }
}
¤¤¤

## Common mistakes
- Overriding only ¤equals¤: two "equal" objects land in different buckets, so a ¤HashSet¤ keeps both.
- Putting a field that later changes into ¤hashCode¤ for a key already in a map: the entry can no longer be found.
- Writing ¤equals(Point p)¤ (an overload) instead of ¤equals(Object o)¤.
- Java 16+ ¤record¤ types generate both methods for you.
`,
  },
  {
    title: 'String, StringBuilder and StringBuffer',
    category: 'Java',
    body: `| Type | Mutable | Thread-safe | Use for |
|---|---|---|---|
| ¤String¤ | No | Yes (immutable) | Constants, keys, most text |
| ¤StringBuilder¤ | Yes | No | Building text in a loop (fastest) |
| ¤StringBuffer¤ | Yes | Yes (synchronized) | Rarely; older shared-buffer code |

¤¤¤java
String a = "java";
String b = "java";
String c = new String("java");

a == b;        // true  - both point to the same pooled literal
a == c;        // false - new String creates a separate object
a.equals(c);   // true  - same characters (always compare text with equals)
¤¤¤

## Remember
- Strings are immutable, so ¤s += x¤ in a loop creates a new object every time. Use ¤StringBuilder¤.
- String literals live in the **string pool** and are shared; ¤intern()¤ returns the pooled copy.
- ¤equals¤ compares content, ¤==¤ compares references.
- ¤String.join¤, ¤String.format¤ and text blocks (Java 15+) cover most formatting needs.
`,
  },
  {
    title: 'Streams and Optional',
    category: 'Java',
    body: `A stream is a pipeline: **source** then **intermediate** steps (lazy) then one **terminal** step (runs it).

¤¤¤java
List<String> names = users.stream()
    .filter(User::isActive)        // keep active users
    .map(User::getName)            // User -> String
    .sorted()
    .collect(Collectors.toList());

int total = orders.stream().mapToInt(Order::getAmount).sum();
¤¤¤

## Rules of thumb
- Nothing runs until a terminal operation (¤collect¤, ¤forEach¤, ¤count¤, ¤sum¤).
- A stream can be used **once**.
- Do not change the source collection while streaming it.
- ¤parallelStream()¤ helps only for large, CPU-heavy, independent work.

## Optional
¤¤¤java
String city = Optional.ofNullable(user)
    .map(User::getAddress)
    .map(Address::getCity)
    .orElse("Unknown");
¤¤¤
- Use it as a **return type** to say "might be empty"; do not use it for fields or parameters.
- ¤orElse(x)¤ always evaluates ¤x¤; ¤orElseGet(() -> x)¤ only when empty.
- Avoid ¤get()¤ without checking ¤isPresent()¤; prefer ¤orElseThrow()¤.
`,
  },
  {
    title: 'JVM memory and garbage collection',
    category: 'Java',
    revise: true,
    body: `## Where things live
- **Stack** (one per thread): method frames, local variables, primitives and references.
- **Heap** (shared): all objects. Split into **young** (Eden plus Survivor spaces) and **old** generations.
- **Metaspace** (Java 8+): class metadata, outside the heap.

## Garbage collection
- An object is garbage when it cannot be reached from a **GC root** (thread stacks, static fields, active threads).
- New objects start in Eden. A **minor GC** cleans the young generation; survivors age and move to old. A **major / full GC** cleans old.
- G1 is the default collector since Java 9; ZGC and Shenandoah aim for very short pauses.
- A **memory leak** in Java means objects are still reachable but no longer needed (growing static maps, forgotten listeners).

| Error | Typical cause |
|---|---|
| ¤StackOverflowError¤ | Endless or very deep recursion |
| ¤OutOfMemoryError: Java heap space¤ | Too many live objects, or a leak |
| ¤OutOfMemoryError: Metaspace¤ | Too many loaded classes |

¤¤¤bash
java -Xms512m -Xmx2g -jar app.jar     # initial and maximum heap
¤¤¤
`,
  },
  {
    title: 'JDBC: PreparedStatement and connection pools',
    category: 'Java',
    body: `Use a ¤PreparedStatement¤ with a pooled connection: it is safe from SQL injection and fast.

¤¤¤java
String sql = "SELECT id, name FROM users WHERE email = ?";

try (Connection con = dataSource.getConnection();
     PreparedStatement ps = con.prepareStatement(sql)) {
    ps.setString(1, email);               // value is sent separately from the SQL
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
            System.out.println(rs.getLong("id") + " " + rs.getString("name"));
        }
    }
}   // connection, statement and result set are closed automatically
¤¤¤

## Remember
- **Never build SQL by joining strings with user input.** That is SQL injection. Use ¤?¤ placeholders.
- Opening a connection is slow; use a **pool** (HikariCP is the common choice) and close connections to return them.
- Transactions: ¤con.setAutoCommit(false)¤, then ¤commit()¤, or ¤rollback()¤ in the ¤catch¤.
- Use ¤executeBatch()¤ for many inserts.
- Prefer a ¤DataSource¤ over ¤DriverManager¤ in real applications.
`,
  },
  {
    title: 'ACID and transaction isolation levels',
    category: 'Databases',
    revise: true,
    body: `## ACID
- **Atomicity**: all steps of a transaction happen or none do.
- **Consistency**: a transaction moves the database from one valid state to another (constraints hold).
- **Isolation**: concurrent transactions do not see each other's half-finished work.
- **Durability**: once committed, the data survives a crash.

¤¤¤sql
BEGIN;
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;   -- or ROLLBACK; if anything failed
¤¤¤

## Isolation levels
| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| Read uncommitted | possible | possible | possible |
| Read committed | prevented | possible | possible |
| Repeatable read | prevented | prevented | possible* |
| Serializable | prevented | prevented | prevented |

*MySQL InnoDB also guards against most phantoms at this level.

- **Dirty read**: reading another transaction's uncommitted change.
- **Non-repeatable read**: the same row reads differently twice in one transaction.
- **Phantom read**: the same query returns new rows the second time.
- Defaults: PostgreSQL uses Read committed; MySQL InnoDB uses Repeatable read.
`,
  },
  {
    title: 'Database indexes',
    category: 'Databases',
    revise: true,
    body: `An index is a sorted structure (usually a **B-tree**) that lets the database find rows without scanning the whole table.

¤¤¤sql
CREATE INDEX idx_orders_user_date ON orders (user_id, created_at);

-- can use the index (starts with user_id, the leftmost column)
SELECT * FROM orders WHERE user_id = 7 AND created_at >= '2026-01-01';
SELECT * FROM orders WHERE user_id = 7;

-- cannot use it well (skips the leftmost column)
SELECT * FROM orders WHERE created_at >= '2026-01-01';
¤¤¤

## Rules
- **Leftmost prefix**: a composite index works for queries that use its columns from the left.
- **Selectivity**: indexes help most on columns with many distinct values; a flag like ¤is_active¤ rarely benefits.
- A **covering index** contains every column the query needs, so the table is never touched.
- Indexes speed up reads but slow down writes and use space, so index what you query.
- Wrapping the column in a function (¤WHERE LOWER(email) = 'x'¤) or a leading wildcard (¤LIKE '%abc'¤) stops the index being used.
- Check with ¤EXPLAIN¤ before and after.
- Primary keys are indexed automatically; add indexes on foreign keys you join on.
`,
  },
  {
    title: 'Normalisation: 1NF, 2NF, 3NF',
    category: 'Databases',
    body: `Normalisation removes repeated data so each fact is stored once.

| Form | Rule | Fix |
|---|---|---|
| **1NF** | Each cell holds one value; no repeating groups | Split lists into rows |
| **2NF** | 1NF, and every non-key column depends on the **whole** key | Move partly-dependent columns to their own table |
| **3NF** | 2NF, and non-key columns depend **only** on the key (no transitive dependency) | Move columns that depend on another non-key column |

## Example
¤¤¤sql
-- Not normalised: customer details repeat on every order
orders(order_id, customer_id, customer_name, customer_city, total)

-- 3NF: customer facts live in one place
customers(customer_id, name, city)
orders(order_id, customer_id, total)
¤¤¤

- **Why**: avoids update, insert and delete anomalies (change a city in one place, not in many rows).
- **Denormalise on purpose** for read-heavy reports when joins become the bottleneck, and accept the extra upkeep.
- BCNF is a stricter version of 3NF; most designs stop at 3NF.
`,
  },
  {
    title: 'SQL joins explained',
    category: 'Databases',
    body: `| Join | Returns |
|---|---|
| ¤INNER JOIN¤ | Only rows that match in both tables |
| ¤LEFT JOIN¤ | All rows from the left table, plus matches from the right (¤NULL¤ if none) |
| ¤RIGHT JOIN¤ | The mirror of ¤LEFT JOIN¤ |
| ¤FULL OUTER JOIN¤ | All rows from both sides (not available in MySQL) |
| ¤CROSS JOIN¤ | Every combination of rows (a Cartesian product) |

¤¤¤sql
-- orders per user, including users with none
SELECT u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.name;

-- users who have never ordered
SELECT u.*
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;

-- self join: each employee with their manager
SELECT e.name, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;
¤¤¤

## Remember
- In a ¤LEFT JOIN¤, a filter on the right table belongs in ¤ON¤, not ¤WHERE¤, or it turns the join into an inner join.
- Join on indexed columns, usually the foreign key.
- ¤USING (col)¤ is a shorthand when both tables use the same column name.
`,
  },
  {
    title: 'SQL interview queries you should know',
    category: 'Databases',
    body: `## How a query is evaluated
¤FROM¤ then ¤WHERE¤ then ¤GROUP BY¤ then ¤HAVING¤ then ¤SELECT¤ then ¤ORDER BY¤ then ¤LIMIT¤. That is why you cannot use a ¤SELECT¤ alias in ¤WHERE¤.

- ¤WHERE¤ filters rows **before** grouping; ¤HAVING¤ filters groups **after**.
- ¤DELETE¤ removes chosen rows (can roll back); ¤TRUNCATE¤ empties the table quickly; ¤DROP¤ removes the table itself.

## Classics
¤¤¤sql
-- second highest salary
SELECT MAX(salary) FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- duplicate emails
SELECT email, COUNT(*) FROM users
GROUP BY email HAVING COUNT(*) > 1;

-- top 3 earners in each department
SELECT * FROM (
  SELECT e.*, ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
  FROM employees e
) t
WHERE rn <= 3;

-- running total
SELECT order_date, SUM(amount) OVER (ORDER BY order_date) AS running_total
FROM orders;
¤¤¤

## Quick facts
- ¤COUNT(*)¤ counts rows; ¤COUNT(col)¤ skips ¤NULL¤.
- ¤NULL = NULL¤ is not true; use ¤IS NULL¤.
- ¤UNION¤ removes duplicates; ¤UNION ALL¤ keeps them and is faster.
`,
  },
];

export const STUDY_NOTES: StudyNote[] = raw.map((n) => ({ ...n, body: n.body.replace(/¤/g, '`') }));

const isStudy = (i: { meta: Record<string, unknown>; deleted_at: string | null }) => i.meta.sampleSet === 'study' && !i.deleted_at;

/** Adds the Java and database notes once. They are flagged as sample data, so "Remove sample data" removes them too. */
export async function loadStudyNotes(store: DataStore): Promise<number> {
  if ((await store.listItems({ type: 'note' })).some(isStudy)) return 0;
  for (const n of STUDY_NOTES) {
    await store.createItem({
      type: 'note', title: n.title, body: `# ${n.title}\n\n${n.body}`,
      meta: { sample: true, sampleSet: 'study', notebook: n.category, ...(n.revise ? { revise: true } : {}) },
    });
  }
  return STUDY_NOTES.length;
}

export async function hasStudyNotes(store: DataStore): Promise<boolean> {
  return (await store.listItems({ type: 'note' })).some(isStudy);
}
