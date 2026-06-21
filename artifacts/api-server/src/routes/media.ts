import { Router } from "express";
import { db, mediaFilesTable, mediaMetadataTable, metadataValuesTable, metadataCategoriesTable } from "@workspace/db";
import { eq, and, or, ilike, sql, inArray, asc, desc } from "drizzle-orm";
import {
  ListMediaQueryParams,
  GetMediaParams,
  UpdateMediaParams,
  UpdateMediaBody,
  DeleteMediaParams,
  GetMediaMetadataParams,
  SetMediaMetadataParams,
  SetMediaMetadataBody,
  BulkUpdateMediaBody,
} from "@workspace/api-zod";
import { formatMedia } from "./media-helpers";

const router = Router();

router.get("/media", async (req, res) => {
  const parsed = ListMediaQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { q, type, rating, favorite, status, sort, order, page, limit } = parsed.data;
  const pageNum = page ?? 1;
  const limitNum = limit ?? 50;
  const offset = (pageNum - 1) * limitNum;

  // Build conditions
  const conds: ReturnType<typeof eq>[] = [];
  if (type && type !== "all") conds.push(eq(mediaFilesTable.type, type));
  if (rating !== undefined) conds.push(eq(mediaFilesTable.rating, rating));
  if (favorite !== undefined) conds.push(eq(mediaFilesTable.favorite, favorite));
  if (status && status !== "all") conds.push(eq(mediaFilesTable.status, status));
  if (q) conds.push(ilike(mediaFilesTable.filename, `%${q}%`));

  // Parse advanced filters (JSON)
  if (parsed.data.filters) {
    try {
      const filters = JSON.parse(parsed.data.filters as string);
      // Tag/metadata filtering via subquery
      if (filters.metadata && Array.isArray(filters.metadata)) {
        for (const f of filters.metadata) {
          const matchingValueIds = await db
            .select({ id: metadataValuesTable.id })
            .from(metadataValuesTable)
            .where(and(eq(metadataValuesTable.categoryId, f.categoryId), ilike(metadataValuesTable.value, `%${f.value}%`)));
          if (matchingValueIds.length > 0) {
            const ids = matchingValueIds.map(v => v.id);
            const mediaIds = await db
              .select({ mediaId: mediaMetadataTable.mediaId })
              .from(mediaMetadataTable)
              .where(inArray(mediaMetadataTable.valueId, ids));
            if (mediaIds.length > 0) {
              conds.push(inArray(mediaFilesTable.id, mediaIds.map(m => m.mediaId)));
            } else {
              // No matches
              return res.json({ items: [], total: 0, page: pageNum, limit: limitNum, pages: 0 });
            }
          }
        }
      }
    } catch {
      // ignore malformed filters
    }
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  // Build order
  const sortCol = sort === "filename" ? mediaFilesTable.filename
    : sort === "size" ? mediaFilesTable.size
    : sort === "duration" ? mediaFilesTable.duration
    : sort === "rating" ? mediaFilesTable.rating
    : sort === "playCount" ? mediaFilesTable.playCount
    : sort === "dateModified" ? mediaFilesTable.dateModified
    : mediaFilesTable.dateAdded;
  const orderDir = order === "asc" ? asc(sortCol) : desc(sortCol);

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(mediaFilesTable).where(where);
  const rows = await db.select().from(mediaFilesTable).where(where).orderBy(orderDir).limit(limitNum).offset(offset);
  const items = await Promise.all(rows.map(formatMedia));
  res.json({ items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
});

router.get("/media/:id", async (req, res) => {
  const parsed = GetMediaParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const [m] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, parsed.data.id));
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(await formatMedia(m));
});

router.patch("/media/:id", async (req, res) => {
  const params = UpdateMediaParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = UpdateMediaBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const [m] = await db.update(mediaFilesTable).set(body.data).where(eq(mediaFilesTable.id, params.data.id)).returning();
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(await formatMedia(m));
});

router.delete("/media/:id", async (req, res) => {
  const parsed = DeleteMediaParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db.delete(mediaFilesTable).where(eq(mediaFilesTable.id, parsed.data.id));
  res.status(204).send();
});

router.get("/media/:id/metadata", async (req, res) => {
  const parsed = GetMediaMetadataParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const metadata = await db
    .select({
      categoryId: mediaMetadataTable.categoryId,
      categoryName: metadataCategoriesTable.name,
      categorySlug: metadataCategoriesTable.slug,
      valueId: mediaMetadataTable.valueId,
      value: metadataValuesTable.value,
    })
    .from(mediaMetadataTable)
    .innerJoin(metadataCategoriesTable, eq(mediaMetadataTable.categoryId, metadataCategoriesTable.id))
    .innerJoin(metadataValuesTable, eq(mediaMetadataTable.valueId, metadataValuesTable.id))
    .where(eq(mediaMetadataTable.mediaId, parsed.data.id));
  res.json(metadata);
});

router.put("/media/:id/metadata", async (req, res) => {
  const params = SetMediaMetadataParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = SetMediaMetadataBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  // Clear existing
  await db.delete(mediaMetadataTable).where(eq(mediaMetadataTable.mediaId, params.data.id));

  // Upsert values and create relations
  const entries = body.data.entries;
  for (const entry of entries) {
    // Upsert value
    const existing = await db.select().from(metadataValuesTable)
      .where(and(eq(metadataValuesTable.categoryId, entry.categoryId), eq(metadataValuesTable.value, entry.value)));
    let valueId: number;
    if (existing[0]) {
      valueId = existing[0].id;
    } else {
      const [newVal] = await db.insert(metadataValuesTable).values({ categoryId: entry.categoryId, value: entry.value }).returning();
      valueId = newVal.id;
    }
    await db.insert(mediaMetadataTable).values({ mediaId: params.data.id, categoryId: entry.categoryId, valueId }).onConflictDoNothing();
  }

  const metadata = await db
    .select({
      categoryId: mediaMetadataTable.categoryId,
      categoryName: metadataCategoriesTable.name,
      categorySlug: metadataCategoriesTable.slug,
      valueId: mediaMetadataTable.valueId,
      value: metadataValuesTable.value,
    })
    .from(mediaMetadataTable)
    .innerJoin(metadataCategoriesTable, eq(mediaMetadataTable.categoryId, metadataCategoriesTable.id))
    .innerJoin(metadataValuesTable, eq(mediaMetadataTable.valueId, metadataValuesTable.id))
    .where(eq(mediaMetadataTable.mediaId, params.data.id));
  res.json(metadata);
});

router.patch("/media/bulk", async (req, res) => {
  const parsed = BulkUpdateMediaBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { ids, rating, favorite, addMetadata, removeMetadataCategoryIds } = parsed.data;
  if (ids.length === 0) return res.json({ updated: 0 });

  const updates: Record<string, unknown> = {};
  if (rating !== undefined) updates.rating = rating;
  if (favorite !== undefined) updates.favorite = favorite;
  if (Object.keys(updates).length > 0) {
    await db.update(mediaFilesTable).set(updates).where(inArray(mediaFilesTable.id, ids));
  }

  if (removeMetadataCategoryIds?.length) {
    await db.delete(mediaMetadataTable).where(
      and(inArray(mediaMetadataTable.mediaId, ids), inArray(mediaMetadataTable.categoryId, removeMetadataCategoryIds))
    );
  }

  if (addMetadata?.length) {
    for (const entry of addMetadata) {
      const existing = await db.select().from(metadataValuesTable)
        .where(and(eq(metadataValuesTable.categoryId, entry.categoryId), eq(metadataValuesTable.value, entry.value)));
      let valueId: number;
      if (existing[0]) {
        valueId = existing[0].id;
      } else {
        const [newVal] = await db.insert(metadataValuesTable).values({ categoryId: entry.categoryId, value: entry.value }).returning();
        valueId = newVal.id;
      }
      for (const mediaId of ids) {
        await db.insert(mediaMetadataTable).values({ mediaId, categoryId: entry.categoryId, valueId }).onConflictDoNothing();
      }
    }
  }

  res.json({ updated: ids.length });
});

export default router;
