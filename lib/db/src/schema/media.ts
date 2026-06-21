import { pgTable, text, serial, timestamp, boolean, integer, real, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { libraryFoldersTable } from "./library";

export const mediaFilesTable = pgTable("media_files", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  filename: text("filename").notNull(),
  type: text("type").notNull(), // 'video' | 'audio'
  size: bigint("size", { mode: "number" }).notNull().default(0),
  duration: real("duration"),
  width: integer("width"),
  height: integer("height"),
  fps: real("fps"),
  bitrate: integer("bitrate"),
  codec: text("codec"),
  format: text("format").notNull().default(""),
  thumbnail: text("thumbnail"),
  rating: integer("rating"),
  favorite: boolean("favorite").notNull().default(false),
  playCount: integer("play_count").notNull().default(0),
  lastPlayed: timestamp("last_played", { withTimezone: true }),
  status: text("status").notNull().default("available"), // 'available' | 'offline'
  fileHash: text("file_hash"),
  driveId: text("drive_id"),
  dateAdded: timestamp("date_added", { withTimezone: true }).notNull().defaultNow(),
  dateModified: timestamp("date_modified", { withTimezone: true }).notNull().defaultNow(),
  folderId: integer("folder_id").references(() => libraryFoldersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("media_files_type_idx").on(t.type),
  index("media_files_status_idx").on(t.status),
  index("media_files_favorite_idx").on(t.favorite),
  index("media_files_date_added_idx").on(t.dateAdded),
]);

export const insertMediaFileSchema = createInsertSchema(mediaFilesTable).omit({ id: true, dateAdded: true });
export type InsertMediaFile = z.infer<typeof insertMediaFileSchema>;
export type MediaFile = typeof mediaFilesTable.$inferSelect;
