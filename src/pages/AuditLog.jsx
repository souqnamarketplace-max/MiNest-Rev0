import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, AlertTriangle, Trash2, Edit, UserCog, Download, Loader2,
  ArrowLeft, Search, Eye, Filter, Copy, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ACTION_CONFIG = {
  delete: { label: "Deleted", color: "bg-red-100 text-red-700", Icon: Trash2 },
  status_change: { label: "Status Change", color: "bg-blue-100 text-blue-700", Icon: Edit },
  admin_flag_change: { label: "Admin Change", color: "bg-purple-100 text-purple-700", Icon: UserCog },
  bulk_action: { label: "Bulk Action", color: "bg-orange-100 text-orange-700", Icon: Edit },
  export: { label: "Export", color: "bg-gray-100 text-gray-700", Icon: Download },
  impersonate_start: { label: "Impersonation Start", color: "bg-yellow-100 text-yellow-800", Icon: Eye },
  impersonate_end: { label: "Impersonation End", color: "bg-yellow-100 text-yellow-800", Icon: Eye },
  approve: { label: "Approved", color: "bg-green-100 text-green-700", Icon: Shield },
  reject: { label: "Rejected", color: "bg-red-100 text-red-700", Icon: AlertTriangle },
};

export default function AuditLog() {
  const { user, isLoadingAuth, navigateToLogin } = useAuth();
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [search, setSearch] = useState("");

  // Admin check
  const { data: adminProfile } = useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("is_admin, email")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log", filterAction, filterEntity, search],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (filterAction !== "all") q = q.eq("action", filterAction);
      if (filterEntity !== "all") q = q.eq("entity_type", filterEntity);
      if (search.trim()) q = q.or(`actor_email.ilike.%${search}%,entity_id.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!adminProfile?.is_admin,
  });

  // Resolve entity IDs to human-readable names (email for users, title for listings, etc.)
  const entityIds = React.useMemo(() => {
    const map = { listing: new Set(), user_profile: new Set(), saved_search: new Set() };
    for (const log of logs) {
      if (!log.entity_id) continue;
      if (log.entity_type === "listing") map.listing.add(log.entity_id);
      else if (log.entity_type === "user_profile") map.user_profile.add(log.entity_id);
      else if (log.entity_type === "saved_search") map.saved_search.add(log.entity_id);
    }
    return {
      listing: Array.from(map.listing),
      user_profile: Array.from(map.user_profile),
      saved_search: Array.from(map.saved_search),
    };
  }, [logs]);

  const { data: entityNames = {} } = useQuery({
    queryKey: ["audit-log-names", entityIds.listing.length, entityIds.user_profile.length, entityIds.saved_search.length],
    queryFn: async () => {
      const names = { listing: {}, user_profile: {}, saved_search: {} };
      if (entityIds.listing.length > 0) {
        const { data } = await supabase.from("listings").select("id, title, slug, display_id").in("id", entityIds.listing);
        data?.forEach((l) => { names.listing[l.id] = { label: l.title || "(untitled)", link: `/listing/${l.slug || l.id}`, displayId: l.display_id }; });
      }
      if (entityIds.user_profile.length > 0) {
        const { data } = await supabase.from("user_profiles").select("user_id, email, display_name, display_id").in("user_id", entityIds.user_profile);
        data?.forEach((u) => { names.user_profile[u.user_id] = { label: u.display_name || u.email || "(no name)", subLabel: u.email, displayId: u.display_id }; });
      }
      if (entityIds.saved_search.length > 0) {
        const { data } = await supabase.from("saved_searches").select("id, name, display_id").in("id", entityIds.saved_search);
        data?.forEach((s) => { names.saved_search[s.id] = { label: s.name || "(unnamed)", displayId: s.display_id }; });
      }
      return names;
    },
    enabled: entityIds.listing.length > 0 || entityIds.user_profile.length > 0 || entityIds.saved_search.length > 0,
  });

  React.useEffect(() => {
    if (!isLoadingAuth && !user) navigateToLogin(window.location.href);
  }, [user, isLoadingAuth, navigateToLogin]);

  if (isLoadingAuth) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  if (!adminProfile?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-destructive">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-2">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const headers = ["When", "Actor Email", "Action", "Entity Type", "Entity ID", "Metadata"];
    const rows = logs.map((l) => [
      l.created_at,
      l.actor_email || "",
      l.action,
      l.entity_type,
      l.entity_id || "",
      JSON.stringify(l.metadata || {}),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-accent" /> Audit Log
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All admin actions and critical data changes are logged here.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by email or entity ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="delete">Deletions</SelectItem>
            <SelectItem value="status_change">Status changes</SelectItem>
            <SelectItem value="admin_flag_change">Admin flag changes</SelectItem>
            <SelectItem value="bulk_action">Bulk actions</SelectItem>
            <SelectItem value="export">Exports</SelectItem>
            <SelectItem value="impersonate_start">Impersonations</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="listing">Listings</SelectItem>
            <SelectItem value="user_profile">Users</SelectItem>
            <SelectItem value="payment">Payments</SelectItem>
            <SelectItem value="saved_search">Saved searches</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No audit log entries match these filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: "bg-muted text-muted-foreground", Icon: Edit };
            const Icon = cfg.Icon;
            const timeAgo = formatDistanceToNow(new Date(log.created_at), { addSuffix: true });
            const fullDate = format(new Date(log.created_at), "MMM d, yyyy · h:mm a");
            const resolved = log.entity_id && entityNames[log.entity_type]?.[log.entity_id];

            return (
              <div key={log.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Header: badges + timestamp on the right */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{log.entity_type}</Badge>
                        {log.actor_is_admin && <Badge className="text-[10px] bg-accent/10 text-accent border-accent/30">Admin</Badge>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-foreground" title={new Date(log.created_at).toISOString()}>
                          {fullDate}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
                      </div>
                    </div>

                    {/* Actor + Target */}
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Actor: </span>
                        <span className="font-semibold">{log.actor_email || "system"}</span>
                      </p>
                      {log.entity_id && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground text-sm">Target: </span>
                          {resolved?.displayId && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(resolved.displayId);
                                toast.success(`Copied ${resolved.displayId}`);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-md text-xs font-mono font-semibold"
                              title={`Display ID — click to copy. Full UUID: ${log.entity_id}`}
                            >
                              {resolved.displayId}
                            </button>
                          )}
                          {resolved ? (
                            <>
                              {resolved.link ? (
                                <Link to={resolved.link} className="text-accent hover:underline font-medium text-sm inline-flex items-center gap-1">
                                  {resolved.label}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              ) : (
                                <span className="font-medium text-sm">{resolved.label}</span>
                              )}
                              {resolved.subLabel && resolved.subLabel !== resolved.label && (
                                <span className="text-xs text-muted-foreground">{resolved.subLabel}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground italic">(deleted or not loaded)</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(log.entity_id);
                                  toast.success("UUID copied");
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 hover:bg-muted rounded text-[10px] font-mono text-muted-foreground"
                                title={`Full UUID: ${log.entity_id}`}
                              >
                                <Copy className="w-2.5 h-2.5" />
                                {log.entity_id.slice(0, 8)}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata — pretty-printed key/value pairs */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 bg-muted/30 rounded-lg p-2.5 text-xs space-y-0.5">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-muted-foreground font-medium min-w-[100px] flex-shrink-0">
                              {key.replace(/_/g, " ")}:
                            </span>
                            <span className="text-foreground break-all">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-6">
        Showing last 200 entries. Use filters to narrow down or export for full history.
      </p>
    </div>
  );
}
