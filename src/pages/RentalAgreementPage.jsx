/**
 * RentalAgreementPage — dedicated page for viewing a single rental agreement.
 * Route: /rentals/:id
 *
 * Wraps RentalAgreementView with its own page-level chrome (back link,
 * loading state, not-found state). Independent of /my-payments.
 */
import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import RentalAgreementView from "@/components/payments/RentalAgreementView";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";

export default function RentalAgreementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: agreement, isLoading, error, refetch } = useQuery({
    queryKey: ["rental-agreement", id],
    queryFn: async () => {
      if (!id) return null;
      const rows = await entities.RentalAgreement.filter({ id }, null, 1);
      return rows?.[0] || null;
    },
    enabled: !!id && !!user?.id,
  });

  // Permission check: only landlord, tenant, or admin can view.
  const canView = React.useMemo(() => {
    if (!agreement || !user) return false;
    if (user.is_admin) return true;
    return (
      agreement.owner_user_id === user.id ||
      agreement.tenant_user_id === user.id
    );
  }, [agreement, user]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading agreement…
        </div>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Agreement not found</h2>
          <p className="text-sm text-muted-foreground">
            This rental agreement doesn't exist or you don't have permission to view it.
          </p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-foreground">Not authorized</h2>
          <p className="text-sm text-muted-foreground">You don't have permission to view this agreement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
      <RentalAgreementView
        agreement={agreement}
        onSigned={() => refetch()}
        onDeclined={() => navigate("/dashboard")}
      />
    </div>
  );
}
