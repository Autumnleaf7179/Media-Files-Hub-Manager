import React, { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetMedia, useUpdateMedia, useSetMediaMetadata, useGetMetadataCategories,
  getGetMediaQueryKey, getGetMetadataCategoriesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Heart, Star, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { formatBytes, formatDuration } from "@/lib/utils";

export default function MediaDetail() {
  const [, params] = useRoute("/media/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const qc = useQueryClient();

  const { data: media, isLoading } = useGetMedia(id, { query: { enabled: !!id, queryKey: getGetMediaQueryKey(id) } });
  const { data: categories } = useGetMetadataCategories({ query: { queryKey: getGetMetadataCategoriesQueryKey() } });
  const updateMedia = useUpdateMedia();
  const setMetadata = useSetMediaMetadata();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!media) return <div className="p-8 text-muted-foreground">Media not found.</div>;

  const groupedMeta: Record<string, { categoryId: number; valueId: number; value: string }[]> = {};
  for (const entry of media.metadata ?? []) {
    if (!groupedMeta[entry.categoryName]) groupedMeta[entry.categoryName] = [];
    groupedMeta[entry.categoryName].push(entry);
  }

  function toggleFavorite() {
    updateMedia.mutate({ id, data: { favorite: !media!.favorite } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMediaQueryKey(id) })
    });
  }

  function setRating(r: number) {
    updateMedia.mutate({ id, data: { rating: r } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMediaQueryKey(id) })
    });
  }

  function removeMetaValue(categoryId: number, valueId: number) {
    const newEntries = (media!.metadata ?? [])
      .filter(e => !(e.categoryId === categoryId && e.valueId === valueId))
      .map(e => ({ categoryId: e.categoryId, value: e.value }));
    setMetadata.mutate({ id, data: { entries: newEntries } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMediaQueryKey(id) })
    });
  }

  function addMetaValue() {
    if (!selectedCategoryId || !newTag.trim()) return;
    const existing = (media!.metadata ?? []).map(e => ({ categoryId: e.categoryId, value: e.value }));
    const newEntries = [...existing, { categoryId: selectedCategoryId, value: newTag.trim() }];
    setMetadata.mutate({ id, data: { entries: newEntries } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMediaQueryKey(id) });
        setNewTag("");
      }
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/search")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{media.filename}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={media.type === "video" ? "default" : "secondary"}>{media.type}</Badge>
            <Badge variant={media.status === "offline" ? "destructive" : "outline"}>{media.status}</Badge>
            <span className="text-sm text-muted-foreground">{media.format.toUpperCase()}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFavorite} className={media.favorite ? "text-rose-500" : "text-muted-foreground"}>
          <Heart className="h-5 w-5" fill={media.favorite ? "currentColor" : "none"} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {media.type === "video" ? (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video ref={videoRef} className="w-full h-full" muted={muted} src={`file://${media.path}`} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center gap-3">
                <Button size="icon" variant="ghost" className="text-white" onClick={() => videoRef.current?.[playing ? "pause" : "play"]()}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="text-white" onClick={() => setMuted(!muted)}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="text-white ml-auto" onClick={() => videoRef.current?.requestFullscreen()}>
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-lg p-8 flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <Volume2 className="h-10 w-10 text-primary" />
              </div>
              <p className="font-semibold text-lg">{media.filename}</p>
              <audio controls className="w-full" src={`file://${media.path}`} />
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Rating</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setRating(s)} className={`text-2xl transition-colors ${(media.rating ?? 0) >= s ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400/70"}`}>
                    <Star className="h-6 w-6" fill={(media.rating ?? 0) >= s ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">File Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow label="Size" value={formatBytes(media.size)} />
              {media.duration != null && <InfoRow label="Duration" value={formatDuration(media.duration)} />}
              {media.width && media.height && <InfoRow label="Resolution" value={`${media.width}×${media.height}`} />}
              {media.fps && <InfoRow label="FPS" value={media.fps.toFixed(3)} />}
              {media.codec && <InfoRow label="Codec" value={media.codec} />}
              {media.bitrate && <InfoRow label="Bitrate" value={`${media.bitrate} kbps`} />}
              <InfoRow label="Plays" value={String(media.playCount)} />
              <InfoRow label="Added" value={new Date(media.dateAdded).toLocaleDateString()} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Metadata</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setEditingMeta(!editingMeta)}>
                  {editingMeta ? "Done" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(groupedMeta).map(([catName, vals]) => (
                <div key={catName}>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">{catName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vals.map(v => (
                      <Badge key={v.valueId} variant="secondary" className="gap-1">
                        {v.value}
                        {editingMeta && (
                          <button onClick={() => removeMetaValue(v.categoryId, v.valueId)} className="ml-1 hover:text-destructive">×</button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {editingMeta && (
                <div className="flex gap-2 pt-2">
                  <select
                    className="text-sm bg-input border rounded px-2 py-1 flex-1"
                    value={selectedCategoryId ?? ""}
                    onChange={e => setSelectedCategoryId(Number(e.target.value) || null)}
                  >
                    <option value="">Category</option>
                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    className="text-sm bg-input border rounded px-2 py-1 flex-1"
                    placeholder="Value"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addMetaValue()}
                  />
                  <Button size="sm" onClick={addMetaValue}>Add</Button>
                </div>
              )}
              {(media.metadata ?? []).length === 0 && !editingMeta && (
                <p className="text-xs text-muted-foreground">No metadata yet. Click Edit to add.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">File Path</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground break-all font-mono">{media.path}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
