import React from "react";
import { 
  useGetLibraryStats, 
  useGetRecentMedia, 
  useGetTopMedia,
  getGetLibraryStatsQueryKey,
  getGetRecentMediaQueryKey,
  getGetTopMediaQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDuration } from "@/lib/utils";
import { FileVideo, FileAudio, Clock, HardDrive, PlaySquare, Tags, Heart } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetLibraryStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentMedia();
  const { data: top, isLoading: topLoading } = useGetTopMedia({ limit: 10 });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Files" value={stats?.totalFiles ?? 0} icon={<HardDrive className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Videos" value={stats?.videoCount ?? 0} icon={<FileVideo className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Audio" value={stats?.audioCount ?? 0} icon={<FileAudio className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Total Size" value={stats ? formatBytes(stats.totalSize) : "0 B"} icon={<HardDrive className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Duration" value={stats ? formatDuration(stats.totalDuration) : "0:00"} icon={<Clock className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Playlists" value={stats?.totalPlaylists ?? 0} icon={<PlaySquare className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Favorites" value={stats?.favoriteCount ?? 0} icon={<Heart className="h-4 w-4" />} loading={statsLoading} />
        <StatCard title="Tags" value={stats?.totalTags ?? 0} icon={<Tags className="h-4 w-4" />} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recently Added</h2>
            <Link href="/search?sort=dateAdded&order=desc" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {recent?.recentlyAdded.slice(0, 4).map(media => (
              <MediaMiniCard key={media.id} media={media} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recently Played</h2>
            <Link href="/search?sort=lastPlayed&order=desc" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {recent?.recentlyPlayed.slice(0, 4).map(media => (
              <MediaMiniCard key={media.id} media={media} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string, value: string | number, icon: React.ReactNode, loading: boolean }) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? <div className="h-8 w-16 bg-muted animate-pulse rounded" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function MediaMiniCard({ media }: { media: any }) {
  return (
    <Link href={`/media/${media.id}`} className="block group">
      <div className="relative aspect-video rounded-md overflow-hidden bg-muted mb-2 border border-border">
        {media.thumbnail ? (
          <img src={media.thumbnail} alt={media.filename} className="object-cover w-full h-full transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            {media.type === 'video' ? <FileVideo className="h-8 w-8" /> : <FileAudio className="h-8 w-8" />}
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white">
          {formatDuration(media.duration || 0)}
        </div>
      </div>
      <p className="text-sm font-medium truncate" title={media.filename}>{media.filename}</p>
    </Link>
  );
}
