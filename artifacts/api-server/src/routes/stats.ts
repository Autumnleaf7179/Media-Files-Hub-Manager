import { Router } from "express";
import { db, mediaFilesTable, playlistsTable, metadataCategoriesTable, metadataValuesTable, mediaMetadataTable, playbackHistoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { GetTopMediaQueryParams } from "@workspace/api-zod";
import { formatMedia } from "./media-helpers";

const router = Router();

router.get("/stats/overview", async (req, res) => {
  const [{ totalFiles }] = await db.select({ totalFiles: sql<number>`count(*)::int` }).from(mediaFilesTable);
  const [{ videoCount }] = await db.select({ videoCount: sql<number>`count(*)::int` }).from(mediaFilesTable).where(eq(mediaFilesTable.type, "video"));
  const [{ audioCount }] = await db.select({ audioCount: sql<number>`count(*)::int` }).from(mediaFilesTable).where(eq(mediaFilesTable.type, "audio"));
  const [{ totalDuration }] = await db.select({ totalDuration: sql<number>`coalesce(sum(duration), 0)::float` }).from(mediaFilesTable);
  const [{ totalSize }] = await db.select({ totalSize: sql<number>`coalesce(sum(size), 0)::bigint` }).from(mediaFilesTable);
  const [{ totalPlaylists }] = await db.select({ totalPlaylists: sql<number>`count(*)::int` }).from(playlistsTable);
  const [{ totalTags }] = await db.select({ totalTags: sql<number>`count(*)::int` }).from(metadataValuesTable);
  const [{ offlineCount }] = await db.select({ offlineCount: sql<number>`count(*)::int` }).from(mediaFilesTable).where(eq(mediaFilesTable.status, "offline"));
  const [{ favoriteCount }] = await db.select({ favoriteCount: sql<number>`count(*)::int` }).from(mediaFilesTable).where(eq(mediaFilesTable.favorite, true));

  const cats = await db.select().from(metadataCategoriesTable);
  const topCategories = await Promise.all(cats.map(async c => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(mediaMetadataTable).where(eq(mediaMetadataTable.categoryId, c.id));
    return { name: c.name, count };
  }));

  res.json({
    totalFiles,
    videoCount,
    audioCount,
    totalDuration,
    totalSize: Number(totalSize),
    totalPlaylists,
    totalTags,
    offlineCount,
    favoriteCount,
    topCategories: topCategories.sort((a, b) => b.count - a.count).slice(0, 5),
  });
});

router.get("/stats/recent", async (req, res) => {
  const recentlyAddedRaw = await db.select().from(mediaFilesTable).orderBy(desc(mediaFilesTable.dateAdded)).limit(12);
  const recentlyPlayedRaw = await db.select().from(mediaFilesTable).where(sql`last_played is not null`).orderBy(desc(mediaFilesTable.lastPlayed)).limit(12);
  const recentlyAdded = await Promise.all(recentlyAddedRaw.map(formatMedia));
  const recentlyPlayed = await Promise.all(recentlyPlayedRaw.map(formatMedia));
  res.json({ recentlyAdded, recentlyPlayed });
});

router.get("/stats/top", async (req, res) => {
  const parsed = GetTopMediaQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 12) : 12;
  const topRaw = await db.select().from(mediaFilesTable).orderBy(desc(mediaFilesTable.playCount)).limit(limit);
  const top = await Promise.all(topRaw.map(formatMedia));
  res.json(top);
});

export default router;
