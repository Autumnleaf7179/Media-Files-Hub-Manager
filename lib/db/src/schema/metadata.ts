import { pgTable, text, serial, timestamp, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mediaFilesTable } from "./media";

export const metadataCategoriesTable = pgTable("metadata_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metadataValuesTable = pgTable("metadata_values", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => metadataCategoriesTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("metadata_values_cat_value_idx").on(t.categoryId, t.value),
  index("metadata_values_category_idx").on(t.categoryId),
]);

export const mediaMetadataTable = pgTable("media_metadata", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").notNull().references(() => mediaFilesTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => metadataCategoriesTable.id, { onDelete: "cascade" }),
  valueId: integer("value_id").notNull().references(() => metadataValuesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("media_metadata_unique_idx").on(t.mediaId, t.categoryId, t.valueId),
  index("media_metadata_media_idx").on(t.mediaId),
  index("media_metadata_category_idx").on(t.categoryId),
]);

export const insertMetadataCategorySchema = createInsertSchema(metadataCategoriesTable).omit({ id: true, createdAt: true });
export type InsertMetadataCategory = z.infer<typeof insertMetadataCategorySchema>;
export type MetadataCategory = typeof metadataCategoriesTable.$inferSelect;

export const insertMetadataValueSchema = createInsertSchema(metadataValuesTable).omit({ id: true, createdAt: true });
export type InsertMetadataValue = z.infer<typeof insertMetadataValueSchema>;
export type MetadataValue = typeof metadataValuesTable.$inferSelect;
