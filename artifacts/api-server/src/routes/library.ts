import { Router } from "express";
import { db, libraryFoldersTable, mediaFilesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  AddLibraryFolderBody,
  RemoveLibraryFolderParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/library/folders", async (req, res) => {
  const folders = await db
    .select({
      id: libraryFoldersTable.id,
      path: libraryFoldersTable.path,
      name: libraryFoldersTable.name,
      enabled: libraryFoldersTable.enabled,
      lastScanned: libraryFoldersTable.lastScanned,
      fileCount: libraryFoldersTable.fileCount,
      createdAt: libraryFoldersTable.createdAt,
    })
    .from(libraryFoldersTable)
    .orderBy(libraryFoldersTable.createdAt);
  res.json(folders.map(f => ({ ...f, lastScanned: f.lastScanned?.toISOString() ?? null, createdAt: f.createdAt.toISOString() })));
});

router.post("/library/folders", async (req, res) => {
  const parsed = AddLibraryFolderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { path, name } = parsed.data;
  const folderName = name ?? path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const [folder] = await db.insert(libraryFoldersTable).values({ path, name: folderName }).returning();
  res.status(201).json({ ...folder, lastScanned: folder.lastScanned?.toISOString() ?? null, createdAt: folder.createdAt.toISOString() });
});

router.delete("/library/folders/:id", async (req, res) => {
  const parsed = RemoveLibraryFolderParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db.delete(libraryFoldersTable).where(eq(libraryFoldersTable.id, parsed.data.id));
  res.status(204).send();
});

router.post("/library/scan", async (req, res) => {
  const start = Date.now();
  // In a real Electron app this would trigger an OS-level file scan.
  // In this web preview, we simulate the scan result.
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(mediaFilesTable);
  await db.update(libraryFoldersTable).set({ lastScanned: new Date() });
  const duration = (Date.now() - start) / 1000;
  res.json({ added: 0, updated: total, removed: 0, duration });
});

export default router;
