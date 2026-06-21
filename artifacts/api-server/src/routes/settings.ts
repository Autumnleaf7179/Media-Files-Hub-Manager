import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

const DEFAULT_SETTINGS = {
  theme: "dark",
  thumbnailSize: "medium",
  autoScan: false,
  scanInterval: 3600,
  defaultView: "grid",
  videoPlayer: "native",
  audioPlayer: "native",
  resumePlayback: true,
  showOfflineFiles: true,
};

async function getSettingsMap() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function buildSettings(map: Record<string, string>) {
  return {
    theme: map.theme ?? DEFAULT_SETTINGS.theme,
    thumbnailSize: map.thumbnailSize ?? DEFAULT_SETTINGS.thumbnailSize,
    autoScan: (map.autoScan ?? String(DEFAULT_SETTINGS.autoScan)) === "true",
    scanInterval: Number(map.scanInterval ?? DEFAULT_SETTINGS.scanInterval),
    defaultView: map.defaultView ?? DEFAULT_SETTINGS.defaultView,
    videoPlayer: map.videoPlayer ?? DEFAULT_SETTINGS.videoPlayer,
    audioPlayer: map.audioPlayer ?? DEFAULT_SETTINGS.audioPlayer,
    resumePlayback: (map.resumePlayback ?? String(DEFAULT_SETTINGS.resumePlayback)) === "true",
    showOfflineFiles: (map.showOfflineFiles ?? String(DEFAULT_SETTINGS.showOfflineFiles)) === "true",
  };
}

router.get("/settings", async (req, res) => {
  const map = await getSettingsMap();
  res.json(buildSettings(map));
});

router.patch("/settings", async (req, res) => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    await db.insert(settingsTable).values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }
  const map = await getSettingsMap();
  res.json(buildSettings(map));
});

export default router;
