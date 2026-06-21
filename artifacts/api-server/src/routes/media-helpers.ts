import { db, mediaFilesTable, mediaMetadataTable, metadataCategoriesTable, metadataValuesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type DbMediaFile = typeof mediaFilesTable.$inferSelect;

export async function formatMedia(m: DbMediaFile) {
  const metadata = await db
    .select({
      categoryId: mediaMetadataTable.categoryId,
      categoryName: metadataCategoriesTable.name,
      categorySlug: metadataCategoriesTable.slug,
      valueId: mediaMetadataTable.valueId,
      value: metadataValuesTable.value,
    })
    .from(mediaMetadataTable)
    .innerJoin(metadataCategoriesTable, eq(mediaMetadataTable.categoryId, metadataCategoriesTable.id))
    .innerJoin(metadataValuesTable, eq(mediaMetadataTable.valueId, metadataValuesTable.id))
    .where(eq(mediaMetadataTable.mediaId, m.id));

  return {
    id: m.id,
    path: m.path,
    filename: m.filename,
    type: m.type,
    size: m.size,
    duration: m.duration ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    fps: m.fps ?? null,
    bitrate: m.bitrate ?? null,
    codec: m.codec ?? null,
    format: m.format,
    thumbnail: m.thumbnail ?? null,
    rating: m.rating ?? null,
    favorite: m.favorite,
    playCount: m.playCount,
    lastPlayed: m.lastPlayed?.toISOString() ?? null,
    status: m.status,
    dateAdded: m.dateAdded.toISOString(),
    dateModified: m.dateModified.toISOString(),
    folderId: m.folderId ?? null,
    metadata,
  };
}
