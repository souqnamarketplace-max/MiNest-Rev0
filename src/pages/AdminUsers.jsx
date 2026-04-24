import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Users, Download, Loader2, ArrowLeft, Search, Eye,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { startImpersonation } from "@/lib/impersonation";
import { exportUsers } from "@/lib/adminExports";
import { toast } from "sonner";

export default function AdminUsers() {
  const { user, isLoadingAuth, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: adminProfile } = useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let q = supabase
        .from("user_profiles")
        .select("user_id, email, display_name, country, city, is_admin, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (search.trim()) {
        q = q.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!adminProfile?.is_admin,
  });

  React.useEffect(() => {
    if (!isLoadingAuth && !user) navigateToLogin(window.location.href);
  }, [user, isLoadingAuth, navigateToLogin]);

  const handleImpersonate = async (target) => {
    const reason = window.prompt(`Enter reason for impersonating ${target.email}:\n(e.g. "customer reported bug", "support ticket #123")`);
    if (!reason) return;
    await startImpersonation(target.user_id, target.email, reason);
    toast.success(`Now viewing as ${target.email}`);
    navigate("/");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportUsers();
      toast.success(`Exported ${count} users.`);
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (isLoadingAuth) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  if (!adminProfile?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-destructive">Access Denied</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-accent" /> Users
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse users, impersonate for support, export to CSV.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Exporting</> : <><Download className="w-4 h-4 mr-1.5" /> Export CSV</>}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl border border-border p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No users match "{search}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.user_id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold">{u.display_name || "(no name)"}</p>
                    {u.is_admin && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Admin</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {u.country}{u.city ? ` · ${u.city}` : ""} · Joined {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleImpersonate(u)}
                  disabled={u.user_id === user?.id}
                  title={u.user_id === user?.id ? "Can't impersonate yourself" : "View app as this user"}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> View as
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-6">
        Showing up to 500 users. Note: impersonation is view-only and logged to the audit log.
      </p>
    </div>
  );
}
