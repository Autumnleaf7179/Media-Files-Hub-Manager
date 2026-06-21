---
name: Playlist items seeding silent no-op
description: ON CONFLICT DO NOTHING silently no-ops if no unique constraint exists on the table
---

When seeding `playlist_items` (or any junction table without a unique constraint defined), `INSERT ... ON CONFLICT DO NOTHING` will silently insert zero rows if no conflictable column is specified and no actual conflict exists — it won't throw, it just does nothing when the INSERT would succeed.

**Why:** `ON CONFLICT DO NOTHING` requires at least one unique/exclusion constraint to be meaningful. Without one, Postgres can't determine what to do on conflict and the clause becomes a no-op for all rows.

**How to apply:** Either:
1. Add a unique constraint to the table (e.g., `UNIQUE (playlist_id, media_id)`)  
2. Seed without `ON CONFLICT DO NOTHING` when the table has no constraint
3. Use `ON CONFLICT (specific_column) DO NOTHING` referencing an actual constraint column
