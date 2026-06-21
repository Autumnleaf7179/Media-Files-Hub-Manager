import { Router } from "express";
import { db, playlistsTable, playlistItemsTable, mediaFilesTable, metadataCategoriesTable, metadataValuesTable, mediaMetadataTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import {
  CreatePlaylistBody,
  GetPlaylistParams,
  UpdatePlaylistParams,
  UpdatePlaylistBody,
  DeletePlaylistParams,
  AddToPlaylistParams,
  AddToPlaylistBody,
  ReorderPlaylistParams,
  ReorderPlaylistBody,
  RemoveFromPlaylistParams,
} from "@workspace/api-zod";
import { formatMedia } from "./media-helpers";

const router = Router();

async function getPlaylistWithStats(id: number) {
  const pl = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id));
  if (!pl[0]) return null;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, id));
  const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${mediaFilesTable.duration}), 0)::float` })
    .from(playlistItemsTable)
    .leftJoin(mediaFilesTable, eq(playlistItemsTable.mediaId, mediaFilesTable.id))
    .where(eq(playlistItemsTable.playlistId, id));
  return {
    ...pl[0],
    itemCount: count,
    totalDuration: total,
    createdAt: pl[0].createdAt.toISOString(),
    updatedAt: pl[0].updatedAt.toISOString(),
  };
}

router.get("/playlists", async (req, res) => {
  const pls = await db.select().from(playlistsTable).orderBy(playlistsTable.createdAt);
  const result = await Promise.all(pls.map(async pl => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, pl.id));
    const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${mediaFilesTable.duration}), 0)::float` })
      .from(playlistItemsTable)
      .leftJoin(mediaFilesTable, eq(playlistItemsTable.mediaId, mediaFilesTable.id))
      .where(eq(playlistItemsTable.playlistId, pl.id));
    return { ...pl, itemCount: count, totalDuration: total, createdAt: pl.createdAt.toISOString(), updatedAt: pl.updatedAt.toISOString() };
  }));
  res.json(result);
});

router.post("/playlists", async (req, res) => {
  const parsed = CreatePlaylistBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { mediaIds, ...data } = parsed.data;
  const [pl] = await db.insert(playlistsTable).values({ ...data, isSmart: data.isSmart ?? false }).returning();
  if (mediaIds?.length) {
    await db.insert(playlistItemsTable).values(mediaIds.map((mid, i) => ({ playlistId: pl.id, mediaId: mid, position: i })));
  }
  const stats = await getPlaylistWithStats(pl.id);
  res.status(201).json(stats);
});

router.get("/playlists/:id", async (req, res) => {
  const parsed = GetPlaylistParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const stats = await getPlaylistWithStats(parsed.data.id);
  if (!stats) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(playlistItemsTable)
    .leftJoin(mediaFilesTable, eq(playlistItemsTable.mediaId, mediaFilesTable.id))
    .where(eq(playlistItemsTable.playlistId, parsed.data.id))
    .orderBy(playlistItemsTable.position);
  const formattedItems = await Promise.all(items.map(async item => ({
    id: item.playlist_items.id,
    position: item.playlist_items.position,
    media: item.media_files ? await formatMedia(item.media_files) : null,
  })));
  res.json({ ...stats, items: formattedItems });
});

router.patch("/playlists/:id", async (req, res) => {
  const params = UpdatePlaylistParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = UpdatePlaylistBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const [pl] = await db.update(playlistsTable).set({ ...body.data, updatedAt: new Date() }).where(eq(playlistsTable.id, params.data.id)).returning();
  if (!pl) return res.status(404).json({ error: "Not found" });
  const stats = await getPlaylistWithStats(pl.id);
  res.json(stats);
});

router.delete("/playlists/:id", async (req, res) => {
  const parsed = DeletePlaylistParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  await db.delete(playlistsTable).where(eq(playlistsTable.id, parsed.data.id));
  res.status(204).send();
});

router.post("/playlists/:id/items", async (req, res) => {
  const params = AddToPlaylistParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = AddToPlaylistBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const [{ maxPos }] = await db.select({ maxPos: sql<number>`coalesce(max(position), -1)::int` }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, params.data.id));
  await db.insert(playlistItemsTable).values(body.data.mediaIds.map((mid, i) => ({ playlistId: params.data.id, mediaId: mid, position: maxPos + 1 + i })));
  await db.update(playlistsTable).set({ updatedAt: new Date() }).where(eq(playlistsTable.id, params.data.id));
  const stats = await getPlaylistWithStats(params.data.id);
  const items = await db.select().from(playlistItemsTable)
    .leftJoin(mediaFilesTable, eq(playlistItemsTable.mediaId, mediaFilesTable.id))
    .where(eq(playlistItemsTable.playlistId, params.data.id))
    .orderBy(playlistItemsTable.position);
  const formattedItems = await Promise.all(items.map(async item => ({
    id: item.playlist_items.id,
    position: item.playlist_items.position,
    media: item.media_files ? await formatMedia(item.media_files) : null,
  })));
  res.json({ ...stats, items: formattedItems });
});

router.put("/playlists/:id/items", async (req, res) => {
  const params = ReorderPlaylistParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const body = ReorderPlaylistBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  await Promise.all(body.data.order.map((itemId, i) =>
    db.update(playlistItemsTable).set({ position: i }).where(eq(playlistItemsTable.id, itemId))
  ));
  await db.update(playlistsTable).set({ updatedAt: new Date() }).where(eq(playlistsTable.id, params.data.id));
  const stats = await getPlaylistWithStats(params.data.id);
  const items = await db.select().from(playlistItemsTable)
    .leftJoin(mediaFilesTable, eq(playlistItemsTable.mediaId, mediaFilesTable.id))
    .where(eq(playlistItemsTable.playlistId, params.data.id))
    .orderBy(playlistItemsTable.position);
  const formattedItems = await Promise.all(items.map(async item => ({
    id: item.playlist_items.id,
    position: item.playlist_items.position,
    media: item.media_files ? await formatMedia(item.media_files) : null,
  })));
  res.json({ ...stats, items: formattedItems });
});

router.delete("/playlists/:id/items/:itemId", async (req, res) => {
  const parsed = RemoveFromPlaylistParams.safeParse({ id: Number(req.params.id), itemId: Number(req.params.itemId) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });
  await db.delete(playlistItemsTable).where(eq(playlistItemsTable.id, parsed.data.itemId));
  await db.update(playlistsTable).set({ updatedAt: new Date() }).where(eq(playlistsTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
