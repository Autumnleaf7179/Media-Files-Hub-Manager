import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const libraryFoldersTable = pgTable("library_folders", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastScanned: timestamp("last_scanned", { withTimezone: true }),
  fileCount: integer("file_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLibraryFolderSchema = createInsertSchema(libraryFoldersTable).omit({ id: true, createdAt: true });
export type InsertLibraryFolder = z.infer<typeof insertLibraryFolderSchema>;
export type LibraryFolder = typeof libraryFoldersTable.$inferSelect;
