import React, { useState } from "react";
import { Link } from "wouter";
import {
  useGetPlaylists, useCreatePlaylist, useDeletePlaylist,
  getGetPlaylistsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlaySquare, Plus, Trash2, Clock, Shuffle } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function Playlists() {
  const qc = useQueryClient();
  const { data: playlists, isLoading } = useGetPlaylists({ query: { queryKey: getGetPlaylistsQueryKey() } });
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    createPlaylist.mutate({ data: { name: name.trim(), description: description.trim() || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPlaylistsQueryKey() });
        setShowCreate(false);
        setName("");
        setDescription("");
      }
    });
  }

  function handleDelete(id: number, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Delete this playlist?")) return;
    deletePlaylist.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPlaylistsQueryKey() })
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Playlist
        </Button>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading playlists...</div>}

      {!isLoading && (!playlists || playlists.length === 0) && (
        <div className="text-center py-16 space-y-3">
          <PlaySquare className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">No playlists yet. Create your first one.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists?.map(pl => (
          <Link key={pl.id} href={`/playlists/${pl.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{pl.name}</CardTitle>
                    {pl.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pl.description}</p>}
                  </div>
                  <button
                    onClick={(e) => handleDelete(pl.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{pl.itemCount} items</span>
                  {pl.totalDuration != null && pl.totalDuration > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(pl.totalDuration)}
                    </span>
                  )}
                  {pl.isSmart && <Badge variant="outline" className="text-xs">Smart</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Playlist</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Playlist name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <Input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createPlaylist.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
