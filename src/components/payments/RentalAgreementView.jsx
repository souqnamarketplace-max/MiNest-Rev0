/**
 * Renders a formal rental agreement for review and signing.
 * Used by both tenant (to sign/decline) and owner (to view accepted agreements).
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Loader2, FileText, CheckCircle2, XCircle, Download } from "lucide-react";
import { formatCents } from "@/lib/paymentHelpers";
import { format } from "date-fns";
import { jsPDF } from "jspdf";

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function RentalAgreementView({ agreement, plan, onSigned, onDeclined }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const checkPage = (needed = 20) => {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addTitle = (text) => {
      checkPage(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(text, pageWidth / 2, y, { align: "center" });
      y += 24;
    };

    const addSectionHeader = (text) => {
      checkPage(30);
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(text.toUpperCase(), margin, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 3, margin + contentWidth, y + 3);
      y += 18;
    };

    const addRow = (label, value) => {
      if (!value) return;
      checkPage(18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(String(value), contentWidth * 0.55);
      doc.text(lines, margin + contentWidth * 0.42, y);
      y += lines.length > 1 ? lines.length * 14 : 16;
    };

    const addText = (text) => {
      checkPage(20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(text, contentWidth);
      lines.forEach(line => { checkPage(14); doc.text(line, margin, y); y += 14; });
      y += 4;
    };

    const addSubHeader = (text) => {
      checkPage(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(text, margin, y);
      y += 16;
    };

    const a = agreement;
    const rentDisplay = formatCents(a?.rent_amount, a?.currency || "cad");
    const depositDisplay = a?.deposit_amount > 0 ? formatCents(a.deposit_amount, a?.currency || "cad") : null;
    const lateFeeDisplay = a?.late_fee_amount > 0 ? formatCents(a.late_fee_amount, a?.currency || "cad") : null;

    // Header
    addTitle("Residential Tenancy Agreement");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`${a.governing_province_or_state || "Canada"} — ${a.country === "US" ? "United States" : "Canada"}`, pageWidth / 2, y, { align: "center" });
    y += 28;

    // Part 1
    addSectionHeader("Part 1 — The Parties");
    addSubHeader("LANDLORD");
    addRow("Legal Name", a.owner_legal_name);
    addRow("Corporation", a.owner_corporation_name);
    addRow("Email", a.owner_email);
    addRow("Phone", a.owner_phone);
    addRow("Mailing Address", a.owner_mailing_address);
    y += 8;
    addSubHeader("TENANT");
    addRow("Legal Name", a.tenant_legal_name);
    addRow("Email", a.tenant_email);
    addRow("Phone", a.tenant_phone);
    addRow("Current Address", a.tenant_current_address);
    addRow("Employer", a.tenant_employer);
    addRow("Date of Birth", a.tenant_date_of_birth);
    addRow("Emergency Contact", a.tenant_emergency_contact_name);
    addRow("Emergency Phone", a.tenant_emergency_contact_phone);

    // Part 2
    addSectionHeader("Part 2 — The Rental Unit");
    addRow("Property Address", a.property_address);
    addRow("Unit Number", a.unit_number);
    addRow("Property Type", a.property_type);
    addRow("Parking", a.parking_included ? `Included${a.parking_space ? ` — ${a.parking_space}` : ""}` : "Not included");
    addRow("Storage", a.storage_included ? "Included" : "Not included");
    if (a.utilities_included?.length > 0) addRow("Utilities Included", a.utilities_included.join(", "));
    if (a.appliances_included?.length > 0) addRow("Appliances Included", a.appliances_included.join(", "));

    // Part 3
    addSectionHeader("Part 3 — Lease Term & Rent");
    addRow("Lease Type", a.lease_type === "fixed_term" ? "Fixed Term" : "Month-to-Month");
    addRow("Start Date", a.lease_start_date);
    addRow("End Date", a.lease_end_date);
    addRow("Monthly Rent", rentDisplay);
    addRow("Rent Due Day", a.rent_due_day ? `${a.rent_due_day}${["st","nd","rd"][a.rent_due_day - 1] || "th"} of each month` : null);
    addRow("Payment Method", a.payment_method?.replace(/_/g, " "));
    if (depositDisplay) addRow("Security Deposit", depositDisplay);
    if (depositDisplay) addRow("Deposit Held By", a.deposit_held_by);
    addRow("Last Month's Rent", a.last_month_rent_collected ? "Collected" : "Not collected");
    if (lateFeeDisplay) addRow("Late Fee", `${lateFeeDisplay} after ${a.late_fee_grace_days}-day grace period`);

    // Part 4
    addSectionHeader("Part 4 — Rules & Conditions");
    addRow("Smoking", a.smoking_permitted ? "Permitted" : "Not permitted");
    addRow("Pets", a.pets_permitted ? `Permitted${a.pet_details ? ` — ${a.pet_details}` : ""}` : "Not permitted");
    addRow("Subletting", a.subletting_permitted ? "Permitted with written consent" : "Not permitted");
    if (a.quiet_hours_start && a.quiet_hours_end) addRow("Quiet Hours", `${a.quiet_hours_start} – ${a.quiet_hours_end}`);
    if (a.guest_policy) addRow("Guest Policy", a.guest_policy);
    if (a.house_rules) { y += 4; addSubHeader("House Rules"); addText(a.house_rules); }
    if (a.special_terms) { y += 4; addSubHeader("Special Terms"); addText(a.special_terms); }

    // Part 5: Signatures
    addSectionHeader("Part 5 — Signatures");
    addSubHeader("LANDLORD SIGNATURE");
    addRow("Signed by", a.owner_signature || "Awaiting signature");
    addRow("Date", a.owner_signed_at ? format(new Date(a.owner_signed_at), "PPP") : "—");
    y += 8;
    addSubHeader("TENANT SIGNATURE");
    addRow("Signed by", a.tenant_signature || "Awaiting signature");
    addRow("Date", a.tenant_signed_at ? format(new Date(a.tenant_signed_at), "PPP") : "—");

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`MiNest — Residential Tenancy Agreement · Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
    }

    const fileName = `rental-agreement-${(a.listing_title || "agreement").replace(/\s+/g, "-").toLowerCase()}.pdf`;
    doc.save(fileName);
  };

  const isTenant = user?.id === agreement?.tenant_user_id;
  const isPending = agreement?.status === "pending_tenant";
  const isAccepted = agreement?.status === "accepted";

  const rentDisplay = formatCents(agreement?.rent_amount, agreement?.currency || "cad");
  const depositDisplay = agreement?.deposit_amount > 0 ? formatCents(agreement.deposit_amount, agreement?.currency || "cad") : null;
  const lateFeeDisplay = agreement?.late_fee_amount > 0 ? formatCents(agreement.late_fee_amount, agreement?.currency || "cad") : null;

  const handleSign = async () => {
    if (!signature.trim()) { toast.error("Please type your full legal name to sign."); return; }
    setLoading(true); setAction("sign");
    try {
      await entities.RentalAgreement.update(agreement.id, {
        status: "active",
        tenant_signed_at: new Date().toISOString(),
        tenant_signature: signature.trim(),
      });
      await entities.Notification.create({
        user_id: agreement.owner_user_id,
        type: "agreement_signed",
        title: "Agreement Signed",
        body: "Your rental agreement has been signed by the tenant.",
        read: false,
        data: { agreement_id: agreement.id },
      });
      toast.success("Agreement signed! The landlord has been notified.");
      onSigned?.();
    } catch (err) {
      toast.error("Failed to sign agreement.");
    } finally {
      setLoading(false); setAction(null);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm("Are you sure you want to decline this rental offer?")) return;
    setLoading(true); setAction("decline");
    try {
      await entities.RentalAgreement.update(agreement.id, { status: "declined" });
      toast.success("Offer declined.");
      onDeclined?.();
    } catch (err) {
      toast.error("Failed to decline.");
    } finally {
      setLoading(false); setAction(null);
    }
  };

  if (!agreement) return null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden print-agreement">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 text-center relative">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <h2 className="text-xl font-bold">Residential Tenancy Agreement</h2>
        <p className="text-sm opacity-70 mt-1">{agreement.governing_province_or_state || "Canada"} — {agreement.country === "US" ? "United States" : "Canada"}</p>
        <button
          onClick={handleDownloadPDF}
          className="absolute top-4 right-4 flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
          title="Download / Print PDF"
        >
          <Download className="w-3.5 h-3.5" /> Download PDF
        </button>
      </div>

      <div className="p-6 space-y-0">
        {/* Status banner */}
        {isAccepted && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-2 mb-6 text-sm text-accent font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Agreement signed and active
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

        {/* Tenant signing UI */}
        {isTenant && isPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3 mt-4">
            <p className="text-sm font-semibold text-yellow-800">Sign this agreement</p>
            <p className="text-xs text-yellow-700">Type your full legal name exactly as it appears above to electronically sign this agreement.</p>
            <Input
              placeholder={`Type "${agreement.tenant_legal_name || "your full legal name"}" to sign`}
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
                onClick={handleSign}
                disabled={loading || !signature.trim()}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {loading && action === "sign" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Sign Agreement
              </Button>
            </div>
          </div>
        )}

        {/* Expiry notice */}
        {isPending && agreement.offer_expires_at && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            This offer expires on {format(new Date(agreement.offer_expires_at), "PPP")}
          </p>
        )}
      </div>
    </div>
  );
}