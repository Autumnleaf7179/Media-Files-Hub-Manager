import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetPlaylist, useUpdatePlaylist, useRemoveFromPlaylist, useReorderPlaylist,
  getGetPlaylistQueryKey, getGetPlaylistsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shuffle, Play, Trash2, GripVertical, Clock, FileVideo, FileAudio } from "lucide-react";
import { formatDuration, formatBytes } from "@/lib/utils";
import { Link } from "wouter";

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlists/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const qc = useQueryClient();

  const { data: playlist, isLoading } = useGetPlaylist(id, { query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(id) } });
  const removeFromPlaylist = useRemoveFromPlaylist();
  const reorderPlaylist = useReorderPlaylist();
  const updatePlaylist = useUpdatePlaylist();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [items, setItems] = useState(playlist?.items ?? []);

  React.useEffect(() => {
    if (playlist?.items) setItems(playlist.items);
  }, [playlist?.items]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!playlist) return <div className="p-8 text-muted-foreground">Playlist not found.</div>;

  function handleRemove(itemId: number) {
    removeFromPlaylist.mutate({ id, itemId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) })
    });
  }

  function handleSaveName() {
    if (!newName.trim()) return;
    updatePlaylist.mutate({ id, data: { name: newName.trim() } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetPlaylistsQueryKey() });
        setEditingName(false);
      }
    });
  }

  function handleDragStart(idx: number) { setDraggedIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIdx, 1);
    newItems.splice(idx, 0, removed);
    setItems(newItems);
    setDraggedIdx(idx);
  }
  function handleDrop() {
    if (draggedIdx === null) return;
    setDraggedIdx(null);
    reorderPlaylist.mutate({ id, data: { order: items.map(i => i.id) } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) })
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/playlists")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex gap-2">
              <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }} className="text-xl font-bold h-9" />
              <Button size="sm" onClick={handleSaveName}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold truncate cursor-pointer hover:text-primary" onClick={() => { setNewName(playlist.name); setEditingName(true); }}>
              {playlist.name}
            </h1>
          )}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{playlist.itemCount} items</span>
            {playlist.totalDuration != null && playlist.totalDuration > 0 && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(playlist.totalDuration)}</span>
            )}
            {playlist.isSmart && <Badge variant="outline">Smart</Badge>}
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Shuffle className="h-4 w-4 mr-2" /> Shuffle
        </Button>
        <Button size="sm">
          <Play className="h-4 w-4 mr-2" /> Play All
        </Button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p>This playlist is empty.</p>
          <Link href="/search" className="text-primary hover:underline text-sm mt-2 block">Browse media to add</Link>
        </div>
      )}

      <div className="space-y-1.5" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group ${draggedIdx === idx ? "opacity-50" : ""}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
              {item.media?.type === "video" ? <FileVideo className="h-4 w-4 text-muted-foreground" /> : <FileAudio className="h-4 w-4 text-muted-foreground" />}
            </div>
            <Link href={`/media/${item.media?.id}`} className="flex-1 min-w-0 hover:text-primary">
              <p className="text-sm font-medium truncate">{item.media?.filename}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.media?.duration != null && <span>{formatDuration(item.media.duration)}</span>}
                {item.media?.size != null && <span>{formatBytes(item.media.size)}</span>}
              </div>
            </Link>
            <button onClick={() => handleRemove(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
