/**
 * Renders a formal rental agreement for review and signing.
 * Used by both tenant (to sign/decline) and owner (to countersign or view active).
 *
 * ZIP 1 fixes:
 *   - Status on tenant-sign: "active" → "accepted" (so payment flow activates)
 *   - NEW: landlord countersign branch for tenant-initiated "pending_owner" status
 *   - NEW: capture IP + user-agent at signing (ESIGN/PIPEDA audit trail)
 *   - Display "pending_owner" state as "Awaiting Landlord Signature"
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Loader2, FileText, CheckCircle2, XCircle, Download, Clock, Hash } from "lucide-react";
import { formatCents } from "@/lib/paymentHelpers";
import { format } from "date-fns";
import { downloadRentalAgreementPdf } from "@/components/payments/RentalAgreementPdf";
import RentalDocumentsViewer from "@/components/payments/RentalDocumentsViewer";
import TerminationPanel from "@/components/payments/TerminationPanel";
import RenewalPanel from "@/components/payments/RenewalPanel";
import TenantInfoForm, { validateTenantInfo } from "@/components/payments/TenantInfoForm";
import TenantIdUploader from "@/components/payments/TenantIdUploader";
import { findConversation, postSystemMessage } from "@/lib/conversationSystemMessages";
import { logAuditEvent, AuditEvents } from "@/lib/auditLog";

// Best-effort IP capture. Does not block signing if it fails.
async function getClientIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ip || null;
  } catch {
    return null;
  }
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function RentalAgreementView({ agreement, plan, onSigned, onDeclined }) {
  const { user } = useAuth();
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);
  const [tenantInfo, setTenantInfo] = useState({
    tenant_legal_name: agreement?.tenant_legal_name || "",
    tenant_phone: agreement?.tenant_phone || "",
    tenant_date_of_birth: agreement?.tenant_date_of_birth || "",
    tenant_current_address: agreement?.tenant_current_address || "",
    tenant_employer: agreement?.tenant_employer || "",
    tenant_emergency_contact_name: agreement?.tenant_emergency_contact_name || "",
    tenant_emergency_contact_phone: agreement?.tenant_emergency_contact_phone || "",
  });
  const [tenantDocs, setTenantDocs] = useState(agreement?.tenant_id_documents || []);

  // Log a single 'agreement_viewed' event when the component first mounts
  // for a given agreement id. Best-effort, non-blocking.
  React.useEffect(() => {
    if (!agreement?.id || !user?.id) return;
    logAuditEvent({
      action: AuditEvents.AGREEMENT_VIEWED,
      targetTable: "rental_agreements",
      targetId: agreement.id,
      metadata: {
        role: user.id === agreement.tenant_user_id ? "tenant"
            : user.id === agreement.owner_user_id ? "landlord"
            : "other",
        agreement_number: agreement.agreement_number ?? null,
        status: agreement.status,
      },
    });
     
  }, [agreement?.id]);

  const isTenant = user?.id === agreement?.tenant_user_id;
  const isOwner = user?.id === agreement?.owner_user_id;

  // Look up is_admin from user_profiles (cached against the same key
  // Header.jsx and Dashboard.jsx use, so this is free when the page was
  // navigated to from anywhere in-app).
  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await entities.UserProfile.filter({ user_id: user.id });
    },
    enabled: !!user?.id,
    staleTime: 120000,
  });
  const isAdmin = !!profiles?.[0]?.is_admin;

  const isPendingTenant = agreement?.status === "pending_tenant";
  const isPendingOwner = agreement?.status === "pending_owner";
  const isAccepted = agreement?.status === "accepted";
  const isDeclined = agreement?.status === "declined";
  const isExpired = agreement?.status === "expired";

  const rentDisplay = formatCents(agreement?.rent_amount, agreement?.currency || "cad");
  const depositDisplay = agreement?.deposit_amount > 0 ? formatCents(agreement.deposit_amount, agreement?.currency || "cad") : null;
  const lateFeeDisplay = agreement?.late_fee_amount > 0 ? formatCents(agreement.late_fee_amount, agreement?.currency || "cad") : null;

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const handleDownloadPDF = async () => {
    if (!agreement) return;
    setDownloadingPdf(true);
    try {
      await downloadRentalAgreementPdf(agreement);
    } catch (err) {
      console.error('[RentalAgreementView] PDF download failed:', err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Tenant signs a landlord-initiated offer: pending_tenant → accepted
  const handleTenantSign = async () => {
    // Validate tenant personal info first
    const infoError = validateTenantInfo(tenantInfo);
    if (infoError) { toast.error(infoError); return; }
    if (!tenantDocs || tenantDocs.length === 0) {
      toast.error("Please upload at least one ID document (passport or government ID).");
      return;
    }
    if (!signature.trim()) { toast.error("Please type your full legal name to sign."); return; }
    if (signature.trim().toLowerCase() !== (tenantInfo.tenant_legal_name || "").trim().toLowerCase()) {
      toast.error("Your signature must match your legal name exactly.");
      return;
    }

    setLoading(true); setAction("sign");
    try {
      const ip = await getClientIp();
      await entities.RentalAgreement.update(agreement.id, {
        ...tenantInfo,
        tenant_id_documents: tenantDocs,
        status: "accepted",
        tenant_signed_at: new Date().toISOString(),
        tenant_signature: signature.trim(),
        tenant_signed_ip: ip,
        tenant_signed_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null)?.slice(0, 500),
      });
      await entities.Notification.create({
        user_id: agreement.owner_user_id,
        type: "agreement_signed",
        title: "Agreement Signed",
        body: "Your rental agreement has been signed by the tenant.",
        read: false,
        data: { agreement_id: agreement.id },
      });

      // Post "rental agreement signed" system message into the conversation
      // between landlord and tenant, if one exists. Best-effort.
      try {
        const convo = await findConversation({
          listingId: agreement.listing_id,
          userIdA: agreement.owner_user_id,
          userIdB: agreement.tenant_user_id,
        });
        if (convo?.id) {
          await postSystemMessage({
            conversationId: convo.id,
            senderUserId: user.id,
            type: "rental_offer_signed",
            payload: {
              agreement_id: agreement.id,
              agreement_number: agreement.agreement_number,
              listing_title: agreement.listing_title,
            },
          });
        }
      } catch (sysErr) {
        console.warn('[RentalAgreementView] system message post failed (non-fatal):', sysErr);
      }

      // Audit log — best-effort, non-blocking.
      logAuditEvent({
        action: AuditEvents.AGREEMENT_SIGNED,
        targetTable: "rental_agreements",
        targetId: agreement.id,
        metadata: {
          role: "tenant",
          agreement_number: agreement.agreement_number ?? null,
          listing_title: agreement.listing_title ?? null,
          status_to: "accepted",
        },
      });

      toast.success("Agreement signed! The landlord has been notified.");
      onSigned?.();
    } catch (err) {
      console.error('[RentalAgreementView] tenant sign failed:', err);
      toast.error("Failed to sign agreement.");
    } finally {
      setLoading(false); setAction(null);
    }
  };

  // Landlord countersigns a tenant-initiated request: pending_owner → accepted
  const handleOwnerCountersign = async () => {
    if (!signature.trim()) { toast.error("Please type your full legal name to sign."); return; }
    setLoading(true); setAction("sign");
    try {
      const ip = await getClientIp();
      await entities.RentalAgreement.update(agreement.id, {
        status: "accepted",
        owner_signed_at: new Date().toISOString(),
        owner_signature: signature.trim(),
        owner_signed_ip: ip,
        owner_signed_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null)?.slice(0, 500),
      });
      await entities.Notification.create({
        user_id: agreement.tenant_user_id,
        type: "agreement_signed",
        title: "Agreement Accepted",
        body: "The landlord has signed your rental agreement.",
        read: false,
        data: { agreement_id: agreement.id },
      });
      toast.success("Agreement accepted and active.");
      onSigned?.();
    } catch (err) {
      console.error('[RentalAgreementView] owner countersign failed:', err);
      toast.error("Failed to sign agreement.");
    } finally {
      setLoading(false); setAction(null);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm("Are you sure you want to decline this rental agreement?")) return;
    setLoading(true); setAction("decline");
    try {
      await entities.RentalAgreement.update(agreement.id, { status: "declined" });
      // Notify the other party
      const otherUserId = isTenant ? agreement.owner_user_id : agreement.tenant_user_id;
      if (otherUserId) {
        await entities.Notification.create({
          user_id: otherUserId,
          type: "agreement_declined",
          title: "Agreement Declined",
          body: "The other party has declined the rental agreement.",
          read: false,
          data: { agreement_id: agreement.id },
        });
      }
      toast.success("Agreement declined.");
      // Audit log — best-effort.
      logAuditEvent({
        action: AuditEvents.AGREEMENT_DECLINED,
        targetTable: "rental_agreements",
        targetId: agreement.id,
        metadata: {
          role: isTenant ? "tenant" : "landlord",
          agreement_number: agreement.agreement_number ?? null,
          listing_title: agreement.listing_title ?? null,
        },
      });
      onDeclined?.();
    } catch (err) {
      console.error('[RentalAgreementView] decline failed:', err);
      toast.error("Failed to decline.");
    } finally {
      setLoading(false); setAction(null);
    }
  };

  if (!agreement) return null;

  // Header banner variant per status
  const statusBanner = (() => {
    if (isAccepted)      return { icon: <CheckCircle2 className="w-4 h-4" />, text: "Agreement signed and active", cls: "bg-accent/10 border-accent/30 text-accent" };
    if (isPendingTenant) return { icon: <Clock className="w-4 h-4" />, text: "Awaiting tenant signature", cls: "bg-amber-50 border-amber-200 text-amber-800" };
    if (isPendingOwner)  return { icon: <Clock className="w-4 h-4" />, text: "Awaiting landlord signature", cls: "bg-amber-50 border-amber-200 text-amber-800" };
    if (isDeclined)      return { icon: <XCircle className="w-4 h-4" />, text: "Agreement declined", cls: "bg-destructive/10 border-destructive/30 text-destructive" };
    if (isExpired)       return { icon: <XCircle className="w-4 h-4" />, text: "Offer expired", cls: "bg-muted border-border text-muted-foreground" };
    return null;
  })();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden print-agreement">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 text-center relative">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <h2 className="text-xl font-bold">Residential Tenancy Agreement</h2>
        <p className="text-sm opacity-70 mt-1">
          {agreement.governing_province_or_state || ""}{agreement.governing_province_or_state ? " — " : ""}
          {agreement.country === "US" ? "United States" : "Canada"}
        </p>
        {/* Agreement number badge */}
        {agreement.agreement_number != null && (
          <div className="inline-flex items-center gap-1.5 mt-3 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold tracking-wide">
            <Hash className="w-3 h-3" />
            <span>Agreement #{String(agreement.agreement_number).padStart(4, "0")}</span>
          </div>
        )}
        <button
          onClick={handleDownloadPDF}
          disabled={downloadingPdf}
          className="absolute top-4 right-4 flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          title="Download / Print PDF"
        >
          {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {downloadingPdf ? "Generating..." : "Download PDF"}
        </button>
      </div>

      <div className="p-6 space-y-0">
        {/* Status banner */}
        {statusBanner && (
          <div className={`border rounded-xl p-3 flex items-center gap-2 mb-6 text-sm font-semibold ${statusBanner.cls}`}>
            {statusBanner.icon} {statusBanner.text}
          </div>
        )}

        {/* Part 1: Parties */}
        <Section title="Part 1 — The Parties">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">LANDLORD</p>
              <Row label="Legal Name" value={agreement.owner_legal_name} />
              <Row label="Corporation" value={agreement.owner_corporation_name} />
              <Row label="Email" value={agreement.owner_email} />
              <Row label="Phone" value={agreement.owner_phone} />
              <Row label="Mailing Address" value={agreement.owner_mailing_address} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">TENANT</p>
              <Row label="Legal Name" value={agreement.tenant_legal_name} />
              <Row label="Email" value={agreement.tenant_email} />
              <Row label="Phone" value={agreement.tenant_phone} />
              <Row label="Current Address" value={agreement.tenant_current_address} />
              <Row label="Employer" value={agreement.tenant_employer} />
              <Row label="Date of Birth" value={agreement.tenant_date_of_birth} />
              <Row label="Emergency Contact" value={agreement.tenant_emergency_contact_name} />
              <Row label="Emergency Phone" value={agreement.tenant_emergency_contact_phone} />
            </div>
          </div>
        </Section>

        {/* Part 2: Rental Unit */}
        <Section title="Part 2 — The Rental Unit">
          <Row label="Property Address" value={agreement.property_address} />
          <Row label="Unit Number" value={agreement.unit_number} />
          <Row label="Property Type" value={agreement.property_type} />
          <Row label="Parking" value={agreement.parking_included ? `Included${agreement.parking_space ? ` — ${agreement.parking_space}` : ""}` : "Not included"} />
          <Row label="Storage" value={agreement.storage_included ? "Included" : "Not included"} />
          {agreement.utilities_included?.length > 0 && (
            <Row label="Utilities Included" value={agreement.utilities_included.join(", ")} />
          )}
          {agreement.appliances_included?.length > 0 && (
            <Row label="Appliances Included" value={agreement.appliances_included.join(", ")} />
          )}
        </Section>

        {/* Part 3: Term & Rent */}
        <Section title="Part 3 — Lease Term & Rent">
          <Row label="Lease Type" value={agreement.lease_type === "fixed_term" ? "Fixed Term" : "Month-to-Month"} />
          <Row label="Start Date" value={agreement.lease_start_date} />
          <Row label="End Date" value={agreement.lease_end_date} />
          <Row label="Monthly Rent" value={rentDisplay} />
          <Row label="Rent Due Day" value={agreement.rent_due_day ? `${agreement.rent_due_day}${["st","nd","rd"][agreement.rent_due_day - 1] || "th"} of each month` : null} />
          <Row label="Payment Method" value={agreement.payment_method?.replace(/_/g, " ")} />
          {depositDisplay && <Row label="Security Deposit" value={depositDisplay} />}
          {depositDisplay && <Row label="Deposit Held By" value={agreement.deposit_held_by} />}
          <Row label="Last Month's Rent" value={agreement.last_month_rent_collected ? "Collected" : "Not collected"} />
          {lateFeeDisplay && <Row label="Late Fee" value={`${lateFeeDisplay} after ${agreement.late_fee_grace_days}-day grace period`} />}
        </Section>

        {/* Part 4: Rules */}
        <Section title="Part 4 — Rules & Conditions">
          <Row label="Smoking" value={agreement.smoking_permitted ? "Permitted" : "Not permitted"} />
          <Row label="Pets" value={agreement.pets_permitted ? `Permitted${agreement.pet_details ? ` — ${agreement.pet_details}` : ""}` : "Not permitted"} />
          <Row label="Subletting" value={agreement.subletting_permitted ? "Permitted with written consent" : "Not permitted"} />
          <Row label="Quiet Hours" value={agreement.quiet_hours_start && agreement.quiet_hours_end ? `${agreement.quiet_hours_start} – ${agreement.quiet_hours_end}` : null} />
          {agreement.guest_policy && <Row label="Guest Policy" value={agreement.guest_policy} />}
          {agreement.house_rules && (
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-1">House Rules</p>
              <p className="text-sm text-foreground whitespace-pre-line">{agreement.house_rules}</p>
            </div>
          )}
          {agreement.special_terms && (
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-1">Special Terms</p>
              <p className="text-sm text-foreground whitespace-pre-line">{agreement.special_terms}</p>
            </div>
          )}
        </Section>

        {/* Part 5: Signatures */}
        <Section title="Part 5 — Signatures">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">LANDLORD SIGNATURE</p>
              {agreement.owner_signature ? (
                <div className="border border-accent/30 bg-accent/5 rounded-lg p-3">
                  <p className="font-semibold text-foreground italic">{agreement.owner_signature}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Signed {agreement.owner_signed_at ? format(new Date(agreement.owner_signed_at), "PPP") : "—"}
                  </p>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground">Awaiting signature</div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">TENANT SIGNATURE</p>
              {agreement.tenant_signature ? (
                <div className="border border-accent/30 bg-accent/5 rounded-lg p-3">
                  <p className="font-semibold text-foreground italic">{agreement.tenant_signature}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Signed {agreement.tenant_signed_at ? format(new Date(agreement.tenant_signed_at), "PPP") : "—"}
                  </p>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground">Awaiting tenant signature</div>
              )}
            </div>
          </div>
        </Section>

        {/* Early termination workflow — only renders for accepted (active)
            agreements; hidden for offers awaiting signature. Renders the
            appropriate panel based on the actor's role and current
            termination_status. */}
        <TerminationPanel agreement={agreement} onChanged={onSigned} />
        <RenewalPanel agreement={agreement} onChanged={onSigned} />
        {/* Tenant Verification Documents — visible to landlord and admins.
            Hidden from the tenant themselves and other non-party users. */}
        {(isOwner || isAdmin) && (
          <Section title="Tenant Verification Documents">
            <RentalDocumentsViewer
              documents={agreement.tenant_id_documents || []}
              visible={true}
              agreementId={agreement.id}
            />
          </Section>
        )}

        {/* Tenant signing UI (landlord sent offer) — fill personal info + upload ID + sign */}
        {isTenant && isPendingTenant && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-4 mt-4">
            <p className="text-sm font-semibold text-yellow-800">Review, fill in your information, and sign</p>
            <p className="text-xs text-yellow-700">
              Please fill in your personal information below, upload at least one valid ID document (passport or government-issued ID), and type your full legal name to sign. Your IP address and timestamp will be recorded for legal audit purposes.
            </p>

            {/* Tenant personal info — required */}
            <div className="bg-white rounded-lg p-4 border border-yellow-300">
              <TenantInfoForm value={tenantInfo} onChange={setTenantInfo} />
            </div>

            {/* ID upload — required */}
            <div className="bg-white rounded-lg p-4 border border-yellow-300 space-y-2">
              <p className="text-sm font-bold text-foreground">ID Verification (Required)</p>
              <p className="text-xs text-muted-foreground">Upload at least one piece of government ID. The landlord will review for identity verification.</p>
              <TenantIdUploader agreementId={agreement.id} value={tenantDocs} onChange={setTenantDocs} />
            </div>

            {/* Signature */}
            <div className="bg-white rounded-lg p-4 border-2 border-accent/30 space-y-2">
              <p className="text-sm font-bold text-foreground">Signature</p>
              <p className="text-xs text-muted-foreground">
                Type your full legal name (<strong className="text-foreground">{tenantInfo.tenant_legal_name || "as entered above"}</strong>) exactly to electronically sign.
              </p>
              <Input
                placeholder={`Type "${tenantInfo.tenant_legal_name || "your full legal name"}" to sign`}
                value={signature}
                onChange={e => setSignature(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleDecline}
                variant="outline"
                disabled={loading}
                className="flex-1 text-destructive border-destructive hover:bg-destructive/5"
              >
                {loading && action === "decline" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                Decline
              </Button>
              <Button
                onClick={handleTenantSign}
                disabled={loading || !signature.trim()}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loading && action === "sign" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Sign Agreement
              </Button>
            </div>
          </div>
        )}

        {/* Landlord countersigning UI (tenant sent request) */}
        {isOwner && isPendingOwner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3 mt-4">
            <p className="text-sm font-semibold text-yellow-800">Review and countersign</p>
            <p className="text-xs text-yellow-700">Review the details above. If everything looks correct, type your full legal name to accept and countersign this agreement. Your IP address and the date/time will be recorded for legal audit purposes.</p>
            <Input
              placeholder={`Type "${agreement.owner_legal_name || "your full legal name"}" to sign`}
              value={signature}
              onChange={e => setSignature(e.target.value)}
              className="bg-white"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleDecline}
                variant="outline"
                disabled={loading}
                className="flex-1 text-destructive border-destructive hover:bg-destructive/5"
              >
                {loading && action === "decline" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                Decline
              </Button>
              <Button
                onClick={handleOwnerCountersign}
                disabled={loading || !signature.trim()}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loading && action === "sign" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Sign & Accept
              </Button>
            </div>
          </div>
        )}

        {/* Expiry notice */}
        {(isPendingTenant || isPendingOwner) && agreement.offer_expires_at && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            This offer expires on {format(new Date(agreement.offer_expires_at), "PPP")}
          </p>
        )}
      </div>
    </div>
  );
}
