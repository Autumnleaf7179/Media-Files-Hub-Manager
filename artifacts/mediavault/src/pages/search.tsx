import React, { useState } from "react";
import { useListMedia, getListMediaQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Filter, Grid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "wouter";
import { formatDuration } from "@/lib/utils";

export default function Search() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  
  const { data, isLoading } = useListMedia({ q: query, limit: 50 });

  return (
    <div className="flex h-full w-full">
      {/* Filters Sidebar */}
      <div className="w-64 border-r border-border bg-card p-4 overflow-y-auto flex-shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Filters</h2>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type</h3>
            {/* Filter controls would go here */}
            <div className="text-sm text-muted-foreground">Not implemented</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border flex items-center gap-4 bg-background">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search media..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading...</div>
          ) : !data?.items.length ? (
            <div className="text-center py-10 text-muted-foreground">No results found</div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {data.items.map((media) => (
                <MediaGridCard key={media.id} media={media} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data.items.map((media) => (
                <MediaListRow key={media.id} media={media} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaGridCard({ media }: { media: any }) {
  return (
    <Link href={`/media/${media.id}`} className="group block bg-card rounded-md border border-border overflow-hidden hover:border-primary transition-colors">
      <div className="relative aspect-video bg-muted">
        {media.thumbnail ? (
          <img src={media.thumbnail} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary">
            No thumb
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white">
          {formatDuration(media.duration || 0)}
        </div>
      </div>
      <div className="p-2">
        <p className="text-sm font-medium truncate" title={media.filename}>{media.filename}</p>
      </div>
    </Link>
  );
}

function MediaListRow({ media }: { media: any }) {
  return (
    <Link href={`/media/${media.id}`} className="flex items-center gap-4 p-2 bg-card rounded-md border border-border hover:border-primary transition-colors">
      <div className="h-12 w-20 bg-muted flex-shrink-0 rounded overflow-hidden">
         {media.thumbnail && <img src={media.thumbnail} className="object-cover w-full h-full" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{media.filename}</p>
      </div>
      <div className="text-xs text-muted-foreground w-16 text-right">
        {formatDuration(media.duration || 0)}
      </div>
    </Link>
  );
}
