import { Link, useLocation } from "wouter";
import { Home, Search, Library, PlaySquare, Settings, Play } from "lucide-react";
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Play className="w-6 h-6 text-primary fill-primary" />
          <span className="font-bold text-lg tracking-tight">MediaVault</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <NavItem href="/" icon={<Home className="w-4 h-4" />} label="Home" />
          <NavItem href="/search" icon={<Search className="w-4 h-4" />} label="Search" />
          
          <div className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Library</div>
          <NavItem href="/media" icon={<Library className="w-4 h-4" />} label="All Media" />
          <NavItem href="/playlists" icon={<PlaySquare className="w-4 h-4" />} label="Playlists" />
        </nav>

        <div className="p-4 border-t border-border">
          <NavItem href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"}`}>
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}
