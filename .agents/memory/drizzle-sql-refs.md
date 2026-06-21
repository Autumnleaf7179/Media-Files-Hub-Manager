---
name: Drizzle SQL template column refs
description: Raw sql`` template in leftJoin queries must use table column refs, not string aliases
---

In Drizzle ORM, when writing raw SQL inside `sql\`\`` template literals within a query that uses `.leftJoin()`, you must reference table columns via `${table.column}` syntax, NOT as bare SQL string aliases like `mf.column`.

**Why:** Drizzle's template interpolation maps `${table.column}` to the correct fully-qualified column name with the join alias. A raw string alias like `mf.duration` is treated as a literal SQL fragment and fails at runtime because Drizzle's join does not guarantee that alias.

**How to apply:** Whenever writing aggregates in joined queries:
```typescript
// ❌ WRONG
sql<number>`coalesce(sum(mf.duration), 0)::float`

// ✅ CORRECT
sql<number>`coalesce(sum(${mediaFilesTable.duration}), 0)::float`
```
