import React, { useState } from "react";
import {
  useGetSettings, useUpdateSettings, useGetLibraryFolders, useAddLibraryFolder, useRemoveLibraryFolder,
  useGetMetadataCategories, useCreateMetadataCategory, useUpdateMetadataCategory, useDeleteMetadataCategory,
  useGetMetadataValues, useScanLibrary,
  getGetSettingsQueryKey, getGetLibraryFoldersQueryKey, getGetMetadataCategoriesQueryKey, getGetMetadataValuesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, Plus, Trash2, Scan, RefreshCw, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Settings() {
  const qc = useQueryClient();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const { data: folders } = useGetLibraryFolders({ query: { queryKey: getGetLibraryFoldersQueryKey() } });
  const addFolder = useAddLibraryFolder();
  const removeFolder = useRemoveLibraryFolder();
  const scanLibrary = useScanLibrary();
  const { data: categories } = useGetMetadataCategories({ query: { queryKey: getGetMetadataCategoriesQueryKey() } });
  const createCategory = useCreateMetadataCategory();
  const updateCategory = useUpdateMetadataCategory();
  const deleteCategory = useDeleteMetadataCategory();

  const [newFolderPath, setNewFolderPath] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [scanResult, setScanResult] = useState<{ added: number; updated: number; removed: number } | null>(null);

  function handleAddFolder() {
    if (!newFolderPath.trim()) return;
    addFolder.mutate({ data: { path: newFolderPath.trim() } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLibraryFoldersQueryKey() });
        setNewFolderPath("");
        toast({ title: "Folder added" });
      }
    });
  }

  function handleRemoveFolder(id: number) {
    if (!confirm("Remove this folder from library?")) return;
    removeFolder.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetLibraryFoldersQueryKey() })
    });
  }

  function handleScan() {
    scanLibrary.mutate({ data: {} }, {
      onSuccess: (result) => {
        setScanResult(result);
        toast({ title: `Scan complete: ${result.added} added, ${result.updated} updated, ${result.removed} removed` });
      }
    });
  }

  function handleSetting(key: string, value: unknown) {
    updateSettings.mutate({ data: { [key]: value } as Parameters<typeof updateSettings.mutate>[0]["data"] }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() })
    });
  }

  function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    createCategory.mutate({ data: { name: newCategoryName.trim() } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMetadataCategoriesQueryKey() });
        setNewCategoryName("");
      }
    });
  }

  function handleUpdateCategory(id: number) {
    if (!editingCatName.trim()) return;
    updateCategory.mutate({ id, data: { name: editingCatName.trim() } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMetadataCategoriesQueryKey() });
        setEditingCatId(null);
      }
    });
  }

  function handleDeleteCategory(id: number) {
    if (!confirm("Delete this category and all its values?")) return;
    deleteCategory.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMetadataCategoriesQueryKey() })
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="playback">Playback</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Library Folders</CardTitle>
                <Button onClick={handleScan} disabled={scanLibrary.isPending} size="sm" variant="outline">
                  {scanLibrary.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Scan className="h-4 w-4 mr-2" />}
                  Scan Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {scanResult && (
                <div className="text-sm text-muted-foreground bg-muted rounded p-3">
                  Last scan: +{scanResult.added} added, ~{scanResult.updated} updated, -{scanResult.removed} removed
                </div>
              )}
              <div className="space-y-2">
                {folders?.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{f.path}</p>
                      <p className="text-xs text-muted-foreground">{f.fileCount} files · Last scanned: {f.lastScanned ? new Date(f.lastScanned).toLocaleString() : "Never"}</p>
                    </div>
                    <button onClick={() => handleRemoveFolder(f.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="/path/to/your/media/folder" value={newFolderPath} onChange={e => setNewFolderPath(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddFolder()} className="font-mono text-sm" />
                <Button onClick={handleAddFolder} disabled={addFolder.isPending || !newFolderPath.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Metadata Categories</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {categories?.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg">
                    <Tag className="h-4 w-4 text-primary flex-shrink-0" />
                    {editingCatId === cat.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input autoFocus value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleUpdateCategory(cat.id); if (e.key === "Escape") setEditingCatId(null); }} className="h-7 text-sm" />
                        <Button size="sm" className="h-7" onClick={() => handleUpdateCategory(cat.id)}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingCatId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">{cat.name}</span>
                        <Badge variant="outline" className="text-xs">{cat.valueCount} values</Badge>
                        {cat.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                        {!cat.isDefault && (
                          <>
                            <button onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }} className="text-muted-foreground hover:text-foreground p-1 text-xs">Rename</button>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-muted-foreground hover:text-destructive p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Input placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateCategory()} />
                <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim() || createCategory.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playback" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Playback Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Resume playback from last position</Label>
                <Switch checked={settings?.resumePlayback ?? true} onCheckedChange={v => handleSetting("resumePlayback", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show offline files in library</Label>
                <Switch checked={settings?.showOfflineFiles ?? true} onCheckedChange={v => handleSetting("showOfflineFiles", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Default view</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant={settings?.defaultView === "grid" ? "default" : "outline"} onClick={() => handleSetting("defaultView", "grid")}>Grid</Button>
                  <Button size="sm" variant={settings?.defaultView === "list" ? "default" : "outline"} onClick={() => handleSetting("defaultView", "list")}>List</Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Thumbnail size</Label>
                <div className="flex gap-2">
                  {["small", "medium", "large"].map(s => (
                    <Button key={s} size="sm" variant={settings?.thumbnailSize === s ? "default" : "outline"} onClick={() => handleSetting("thumbnailSize", s)} className="capitalize">{s}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
