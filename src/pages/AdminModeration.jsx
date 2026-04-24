import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle, Shield, FileText, Filter, RefreshCw
} from "lucide-react";
import ListingModerationCard from "@/components/admin/ListingModerationCard";

export default function AdminModeration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [filter, setFilter] = useState("");

  const { data: adminProfile } = useQuery({
    queryKey: ['admin-profile-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id,
  });

  // Fetch listings by status (only if admin)
  const { data: listings, isLoading, refetch } = useQuery({
    queryKey: ['admin-listings', activeTab],
    queryFn: async () => {
      const statusMap = {
        pending: 'pending_review',
        active: 'active',
        paused: 'paused',
        flagged: 'flagged',
        rejected: 'rejected'
      };
      const status = statusMap[activeTab];
      const results = await entities.Listing.filter({ status });
      return results.sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));
    },
    enabled: !!adminProfile?.is_admin,
  });

  // Fetch audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const logs = await [];
      return logs.sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date)).slice(0, 20);
    },
    enabled: !!adminProfile?.is_admin,
  });

  // Fetch metrics
  const { data: allListings } = useQuery({
    queryKey: ['all-listings'],
    queryFn: async () => entities.Listing.filter({}),
    enabled: !!adminProfile?.is_admin,
  });

  // Admin access check — AFTER all hooks to satisfy Rules of Hooks
  if (!adminProfile?.is_admin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-destructive">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-2">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  const handleActionComplete = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    queryClient.invalidateQueries({ queryKey: ['all-listings'] });
  };

  const metrics = {
    total: allListings?.length || 0,
    active: allListings?.filter(l => l.status === 'active').length || 0,
    pending: allListings?.filter(l => l.status === 'pending_review').length || 0,
    paused: allListings?.filter(l => l.status === 'paused').length || 0,
    rejected: allListings?.filter(l => l.status === 'rejected').length || 0
  };

  const filteredListings = listings?.filter(l =>
    l.title.toLowerCase().includes(filter.toLowerCase()) ||
    l.owner_user_id.toLowerCase().includes(filter.toLowerCase()) ||
    l.city.toLowerCase().includes(filter.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-8 h-8 text-accent" /> MiNest Moderation
            </h1>
            <p className="text-muted-foreground mt-1">Review and manage MiNest listings, reports, and users</p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <MetricCard label="Total Listings" value={metrics.total} />
          <MetricCard label="Active" value={metrics.active} accent />
          <MetricCard label="Pending Review" value={metrics.pending} warning />
          <MetricCard label="Paused" value={metrics.paused} />
          <MetricCard label="Rejected" value={metrics.rejected} destructive />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pending">Pending ({metrics.pending})</TabsTrigger>
            <TabsTrigger value="active">Active ({metrics.active})</TabsTrigger>
            <TabsTrigger value="paused">Paused ({metrics.paused})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({metrics.rejected})</TabsTrigger>
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Listings Tabs */}
          {['pending', 'active', 'paused', 'rejected'].includes(activeTab) && (
            <TabsContent value={activeTab} className="space-y-4">
              {/* Filter */}
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by title, owner, or city..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No listings to review</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredListings.map(listing => (
                    <ListingModerationCard
                      key={listing.id}
                      listing={listing}
                      onActionComplete={handleActionComplete}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Audit Logs */}
          <TabsContent value="logs" className="space-y-4">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Admin</th>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                      <th className="px-4 py-3 text-left font-semibold">Target</th>
                      <th className="px-4 py-3 text-left font-semibold">Reason</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">
                          Loading logs...
                        </td>
                      </tr>
                    ) : auditLogs?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">
                          No audit logs yet
                        </td>
                      </tr>
                    ) : (
                      auditLogs?.map(log => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {log.admin_user_id.split('@')[0]}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground text-xs">
                            {log.action_type.replace(/_/g, ' ').toUpperCase()}
                          </td>
                          <td className="px-4 py-3 text-sm truncate">
                            <div className="font-medium text-foreground">{log.target_title}</div>
                            <div className="text-xs text-muted-foreground">{log.target_type}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-2">
                            {log.reason || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(log.created_at || log.created_date).toLocaleDateString()} {new Date(log.created_at || log.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent, warning, destructive }) {
  const colorClass = accent ? 'bg-accent/10 text-accent' : warning ? 'bg-yellow-100 text-yellow-700' : destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground';
  return (
    <div className={`rounded-lg border border-border p-4 ${colorClass}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}