import { Router } from "express";
import { db, metadataCategoriesTable, metadataValuesTable, mediaMetadataTable } from "@workspace/db";
import { eq, ilike, sql, inArray } from "drizzle-orm";
import {
  CreateMetadataCategoryBody,
  UpdateMetadataCategoryBody,
  UpdateMetadataCategoryParams,
  DeleteMetadataCategoryParams,
  GetMetadataValuesQueryParams,
  UpdateMetadataValueBody,
  UpdateMetadataValueParams,
  DeleteMetadataValueParams,
  MergeMetadataValuesBody,
} from "@workspace/api-zod";

const router = Router();

// Helper to slugify
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

router.get("/metadata/categories", async (req, res) => {
  const cats = await db.select().from(metadataCategoriesTable).orderBy(metadataCategoriesTable.name);
  const withCounts = await Promise.all(cats.map(async c => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(metadataValuesTable).where(eq(metadataValuesTable.categoryId, c.id));
    return { ...c, valueCount: count, createdAt: c.createdAt.toISOString() };
  }));
  res.json(withCounts);
});

router.post("/metadata/categories", async (req, res) => {
  const parsed = CreateMetadataCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const slug = slugify(parsed.data.name);
  const [cat] = await db.insert(metadataCategoriesTable).values({ name: parsed.data.name, slug }).returning();
  res.status(201).json({ ...cat, valueCount: 0, createdAt: cat.createdAt.toISOString() });
});

router.patch("/metadata/categories/:id", async (req, res) => {
  const params = UpdateMetadataCategoryParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = UpdateMetadataCategoryBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const updates: Record<string, unknown> = {};
  if (body.data.name) { updates.name = body.data.name; updates.slug = slugify(body.data.name); }
  const [cat] = await db.update(metadataCategoriesTable).set(updates).where(eq(metadataCategoriesTable.id, params.data.id)).returning();
  if (!cat) return res.status(404).json({ error: "Not found" });
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(metadataValuesTable).where(eq(metadataValuesTable.categoryId, cat.id));
  res.json({ ...cat, valueCount: count, createdAt: cat.createdAt.toISOString() });
});

router.delete("/metadata/categories/:id", async (req, res) => {
  const params = DeleteMetadataCategoryParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  await db.delete(metadataCategoriesTable).where(eq(metadataCategoriesTable.id, params.data.id));
  res.status(204).send();
});

router.get("/metadata/values", async (req, res) => {
  const parsed = GetMetadataValuesQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  let query = db.select().from(metadataValuesTable).orderBy(metadataValuesTable.value);
  const conditions: ReturnType<typeof eq>[] = [];
  if (parsed.data.categoryId) conditions.push(eq(metadataValuesTable.categoryId, parsed.data.categoryId));
  const values = parsed.data.categoryId
    ? await db.select().from(metadataValuesTable).where(eq(metadataValuesTable.categoryId, parsed.data.categoryId)).orderBy(metadataValuesTable.value)
    : await db.select().from(metadataValuesTable).orderBy(metadataValuesTable.value);
  const withCounts = await Promise.all(values.map(async v => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(mediaMetadataTable).where(eq(mediaMetadataTable.valueId, v.id));
    return { ...v, mediaCount: count, createdAt: v.createdAt.toISOString() };
  }));
  const filtered = parsed.data.q
    ? withCounts.filter(v => v.value.toLowerCase().includes((parsed.data.q as string).toLowerCase()))
    : withCounts;
  res.json(filtered);
});

router.patch("/metadata/values/:id", async (req, res) => {
  const params = UpdateMetadataValueParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = UpdateMetadataValueBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const [val] = await db.update(metadataValuesTable).set({ value: body.data.value }).where(eq(metadataValuesTable.id, params.data.id)).returning();
  if (!val) return res.status(404).json({ error: "Not found" });
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(mediaMetadataTable).where(eq(mediaMetadataTable.valueId, val.id));
  res.json({ ...val, mediaCount: count, createdAt: val.createdAt.toISOString() });
});

router.delete("/metadata/values/:id", async (req, res) => {
  const params = DeleteMetadataValueParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  await db.delete(metadataValuesTable).where(eq(metadataValuesTable.id, params.data.id));
  res.status(204).send();
});

router.post("/metadata/values/merge", async (req, res) => {
  const parsed = MergeMetadataValuesBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { sourceIds, targetValue } = parsed.data;
  // Get category from first source
  const [first] = await db.select().from(metadataValuesTable).where(eq(metadataValuesTable.id, sourceIds[0]));
  if (!first) return res.status(404).json({ error: "Source value not found" });
  // Upsert target value
  const existing = await db.select().from(metadataValuesTable)
    .where(eq(metadataValuesTable.categoryId, first.categoryId));
  let target = existing.find(v => v.value.toLowerCase() === targetValue.toLowerCase());
  if (!target) {
    const [created] = await db.insert(metadataValuesTable).values({ categoryId: first.categoryId, value: targetValue }).returning();
    target = created;
  }
  // Reassign all media using source values to target
  for (const sid of sourceIds) {
    if (sid === target.id) continue;
    // Get all media using this source value
    const refs = await db.select().from(mediaMetadataTable).where(eq(mediaMetadataTable.valueId, sid));
    for (const ref of refs) {
      // Check if target already exists for this media+category
      const conflict = await db.select().from(mediaMetadataTable)
        .where(eq(mediaMetadataTable.mediaId, ref.mediaId));
      const hasTarget = conflict.some(r => r.valueId === target!.id);
      if (!hasTarget) {
        await db.update(mediaMetadataTable).set({ valueId: target!.id }).where(eq(mediaMetadataTable.id, ref.id));
      } else {
        await db.delete(mediaMetadataTable).where(eq(mediaMetadataTable.id, ref.id));
      }
    }
    if (sid !== target.id) await db.delete(metadataValuesTable).where(eq(metadataValuesTable.id, sid));
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(mediaMetadataTable).where(eq(mediaMetadataTable.valueId, target.id));
  res.json({ ...target, mediaCount: count, createdAt: target.createdAt.toISOString() });
});

export default router;
