import { Router } from "express";
import { db, playbackHistoryTable, mediaFilesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  GetPlaybackHistoryQueryParams,
  SavePlaybackProgressBody,
  GetPlaybackProgressParams,
} from "@workspace/api-zod";
import { formatMedia } from "./media-helpers";

const router = Router();

router.get("/player/history", async (req, res) => {
  const parsed = GetPlaybackHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const limit = parsed.data.limit ?? 20;
  const page = parsed.data.page ?? 1;
  const offset = (page - 1) * limit;
  const history = await db.select()
    .from(playbackHistoryTable)
    .leftJoin(mediaFilesTable, eq(playbackHistoryTable.mediaId, mediaFilesTable.id))
    .orderBy(desc(playbackHistoryTable.playedAt))
    .limit(limit)
    .offset(offset);
  const result = await Promise.all(history.map(async h => ({
    id: h.playback_history.id,
    mediaId: h.playback_history.mediaId,
    position: h.playback_history.position,
    duration: h.playback_history.duration,
    completed: h.playback_history.completed,
    playedAt: h.playback_history.playedAt.toISOString(),
    media: h.media_files ? await formatMedia(h.media_files) : undefined,
  })));
  res.json(result);
});

router.post("/player/progress", async (req, res) => {
  const parsed = SavePlaybackProgressBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  // Upsert: find latest entry for this media and update, or create new
  const existing = await db.select()
    .from(playbackHistoryTable)
    .where(eq(playbackHistoryTable.mediaId, parsed.data.mediaId))
    .orderBy(desc(playbackHistoryTable.playedAt))
    .limit(1);

  let entry;
  if (existing[0] && !existing[0].completed) {
    [entry] = await db.update(playbackHistoryTable)
      .set({ position: parsed.data.position, duration: parsed.data.duration ?? null, completed: parsed.data.completed ?? false, playedAt: new Date() })
      .where(eq(playbackHistoryTable.id, existing[0].id))
      .returning();
  } else {
    [entry] = await db.insert(playbackHistoryTable)
      .values({ mediaId: parsed.data.mediaId, position: parsed.data.position, duration: parsed.data.duration ?? null, completed: parsed.data.completed ?? false })
      .returning();
  }
  // Update media play count
  await db.update(mediaFilesTable).set({
    playCount: sql`play_count + 1`,
    lastPlayed: new Date(),
  }).where(eq(mediaFilesTable.id, parsed.data.mediaId));

  const media = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, parsed.data.mediaId));
  res.json({
    id: entry.id,
    mediaId: entry.mediaId,
    position: entry.position,
    duration: entry.duration,
    completed: entry.completed,
    playedAt: entry.playedAt.toISOString(),
    media: media[0] ? await formatMedia(media[0]) : undefined,
  });
});

router.get("/player/progress/:mediaId", async (req, res) => {
  const parsed = GetPlaybackProgressParams.safeParse({ mediaId: Number(req.params.mediaId) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid mediaId" });
  const [entry] = await db.select()
    .from(playbackHistoryTable)
    .where(eq(playbackHistoryTable.mediaId, parsed.data.mediaId))
    .orderBy(desc(playbackHistoryTable.playedAt))
    .limit(1);
  if (!entry) return res.status(404).json({ error: "Not found" });
  res.json({
    id: entry.id,
    mediaId: entry.mediaId,
    position: entry.position,
    duration: entry.duration,
    completed: entry.completed,
    playedAt: entry.playedAt.toISOString(),
  });
});

export default router;
