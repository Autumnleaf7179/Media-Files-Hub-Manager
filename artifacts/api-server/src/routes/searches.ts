import { Router } from "express";
import { db, savedSearchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateSavedSearchBody, DeleteSavedSearchParams } from "@workspace/api-zod";

const router = Router();

router.get("/searches", async (req, res) => {
  const searches = await db.select().from(savedSearchesTable).orderBy(savedSearchesTable.createdAt);
  res.json(searches.map(s => ({ ...s, createdAt: s.createdAt.toISOString() })));
});

router.post("/searches", async (req, res) => {
  const parsed = CreateSavedSearchBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const [s] = await db.insert(savedSearchesTable).values(parsed.data).returning();
  res.status(201).json({ ...s, createdAt: s.createdAt.toISOString() });
});

router.delete("/searches/:id", async (req, res) => {
  const parsed = DeleteSavedSearchParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db.delete(savedSearchesTable).where(eq(savedSearchesTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
