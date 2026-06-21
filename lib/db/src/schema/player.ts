import { pgTable, serial, timestamp, boolean, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mediaFilesTable } from "./media";

export const playbackHistoryTable = pgTable("playback_history", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").notNull().references(() => mediaFilesTable.id, { onDelete: "cascade" }),
  position: real("position").notNull().default(0),
  duration: real("duration"),
  completed: boolean("completed").notNull().default(false),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("playback_history_media_idx").on(t.mediaId),
  index("playback_history_played_at_idx").on(t.playedAt),
]);

export const insertPlaybackHistorySchema = createInsertSchema(playbackHistoryTable).omit({ id: true, playedAt: true });
export type InsertPlaybackHistory = z.infer<typeof insertPlaybackHistorySchema>;
export type PlaybackHistory = typeof playbackHistoryTable.$inferSelect;
