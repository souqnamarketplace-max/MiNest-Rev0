/**
 * RentalAgreementPdf.js — generates a polished, generic Residential Tenancy
 * Agreement PDF using jsPDF. No platform branding.
 *
 * Layout:
 *  - Cover page: title, agreement number, jurisdiction, status badge, parties
 *  - Section pages: Parties, Rental Unit, Lease & Rent, Rules, Signatures
 *  - Optional pages: each tenant ID document embedded full-page
 *
 * Conventions:
 *  - All x/y in PDF points (1pt = 1/72in). Letter = 612 x 792.
 *  - Margins: left 56, right 556, top 56, bottom 736.
 */
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { formatCents } from "@/lib/paymentHelpers";

// Layout constants
const PAGE_W = 612;
const PAGE_H = 792;
const M_LEFT = 56;
const M_RIGHT = 556;
const M_TOP = 56;
const M_BOTTOM = 736;
const CONTENT_W = M_RIGHT - M_LEFT;

// Color palette (RGB tuples)
const C_TEXT      = [15, 23, 42];     // slate-900
const C_MUTED     = [100, 116, 139];  // slate-500
const C_RULE      = [203, 213, 225];  // slate-300
const C_SUBTLE    = [241, 245, 249];  // slate-100
const C_ACCENT    = [16, 124, 84];    // brand green-ish
const C_BADGE_OK  = [22, 101, 52];    // green-800
const C_BADGE_WAIT= [161, 98, 7];     // amber-700
const C_BADGE_BG_OK   = [220, 252, 231]; // green-100
const C_BADGE_BG_WAIT = [254, 243, 199]; // amber-100

const fmtAgreementNumber = (n) => {
  if (n == null) return "—";
  return String(n).padStart(4, "0");
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "PPP"); } catch { return String(d); }
};

const fmtMoney = (cents, currency) => {
  if (cents == null) return "—";
  return formatCents(cents, currency || "cad");
};

// --- helpers --------------------------------------------------------------
function setColor(doc, [r, g, b]) { doc.setTextColor(r, g, b); }
function setDraw(doc, [r, g, b]) { doc.setDrawColor(r, g, b); }
function setFill(doc, [r, g, b]) { doc.setFillColor(r, g, b); }

class PdfBuilder {
  constructor(agreement) {
    this.doc = new jsPDF({ unit: "pt", format: "letter" });
    this.agreement = agreement;
    this.y = M_TOP;
  }

  ensureSpace(needed = 20) {
    if (this.y + needed > M_BOTTOM) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = M_TOP;
  }

  hr(color = C_RULE, weight = 0.5) {
    setDraw(this.doc, color);
    this.doc.setLineWidth(weight);
    this.doc.line(M_LEFT, this.y, M_RIGHT, this.y);
    this.y += 6;
  }

  spacer(amt = 12) { this.y += amt; }

  // Section header: thin rule + bold all-caps text
  sectionHeader(text) {
    this.spacer(8);
    this.ensureSpace(40);
    setDraw(this.doc, C_ACCENT);
    this.doc.setLineWidth(2);
    this.doc.line(M_LEFT, this.y, M_LEFT + 24, this.y);
    this.y += 12;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    setColor(this.doc, C_TEXT);
    this.doc.text(text.toUpperCase(), M_LEFT, this.y);
    this.y += 16;
  }

  // Subheader (smaller bold, used in "Parties" boxes etc.)
  subHeader(text) {
    this.ensureSpace(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    setColor(this.doc, C_MUTED);
    this.doc.text(text.toUpperCase(), M_LEFT, this.y);
    this.y += 12;
  }

  // Body paragraph
  para(text) {
    this.ensureSpace(20);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    setColor(this.doc, C_TEXT);
    const lines = this.doc.splitTextToSize(text, CONTENT_W);
    lines.forEach(line => {
      this.ensureSpace(14);
      this.doc.text(line, M_LEFT, this.y);
      this.y += 13;
    });
    this.spacer(4);
  }

  // Label/value row, values truncated to right column
  row(label, value) {
    if (value == null || value === "") return;
    this.ensureSpace(16);
    const labelW = CONTENT_W * 0.42;
    const valueX = M_LEFT + labelW;
    const valueW = CONTENT_W - labelW;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    setColor(this.doc, C_MUTED);
    this.doc.text(String(label), M_LEFT, this.y);
    this.doc.setFont("helvetica", "bold");
    setColor(this.doc, C_TEXT);
    const lines = this.doc.splitTextToSize(String(value), valueW);
    this.doc.text(lines, valueX, this.y);
    this.y += Math.max(14, lines.length * 14);
  }

  // Bordered box (used for parties, signatures)
  box(x, y, w, h, fill = null) {
    if (fill) {
      setFill(this.doc, fill);
      this.doc.rect(x, y, w, h, "F");
    }
    setDraw(this.doc, C_RULE);
    this.doc.setLineWidth(0.5);
    this.doc.rect(x, y, w, h, "S");
  }

  // Status badge — colored pill
  statusBadge(x, y, label, kind) {
    const bg = kind === "ok" ? C_BADGE_BG_OK : C_BADGE_BG_WAIT;
    const fg = kind === "ok" ? C_BADGE_OK : C_BADGE_WAIT;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    const w = this.doc.getTextWidth(label) + 16;
    const h = 16;
    setFill(this.doc, bg);
    this.doc.roundedRect(x, y - h + 4, w, h, 4, 4, "F");
    setColor(this.doc, fg);
    this.doc.text(label, x + 8, y);
  }

  // ---------------- COVER PAGE ----------------
  drawCoverPage() {
    const a = this.agreement;
    this.y = M_TOP + 60;

    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(26);
    setColor(this.doc, C_TEXT);
    const title = "RESIDENTIAL TENANCY AGREEMENT";
    this.doc.text(title, PAGE_W / 2, this.y, { align: "center" });
    this.y += 36;

    // Subtitle: jurisdiction
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(12);
    setColor(this.doc, C_MUTED);
    const jurisdictionText = `${a.governing_province_or_state || "—"}, ${a.country === "US" ? "United States" : "Canada"}`;
    this.doc.text(jurisdictionText, PAGE_W / 2, this.y, { align: "center" });
    this.y += 36;

    // Accent rule
    setDraw(this.doc, C_ACCENT);
    this.doc.setLineWidth(2);
    this.doc.line(PAGE_W / 2 - 40, this.y, PAGE_W / 2 + 40, this.y);
    this.y += 36;

    // Agreement number
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    setColor(this.doc, C_MUTED);
    this.doc.text("AGREEMENT NUMBER", PAGE_W / 2, this.y, { align: "center" });
    this.y += 18;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(20);
    setColor(this.doc, C_ACCENT);
    this.doc.text(`#${fmtAgreementNumber(a.agreement_number)}`, PAGE_W / 2, this.y, { align: "center" });
    this.y += 36;

    // Status badge centered
    const statusLabels = {
      pending_tenant: "AWAITING TENANT SIGNATURE",
      accepted: "SIGNED & ACTIVE",
      declined: "DECLINED",
      expired: "EXPIRED",
      canceled: "CANCELLED",
    };
    const statusKind = a.status === "accepted" ? "ok" : "wait";
    const label = statusLabels[a.status] || a.status?.toUpperCase() || "DRAFT";
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    const labelW = this.doc.getTextWidth(label) + 24;
    const labelH = 22;
    const labelX = (PAGE_W - labelW) / 2;
    const bg = statusKind === "ok" ? C_BADGE_BG_OK : C_BADGE_BG_WAIT;
    const fg = statusKind === "ok" ? C_BADGE_OK : C_BADGE_WAIT;
    setFill(this.doc, bg);
    this.doc.roundedRect(labelX, this.y - 14, labelW, labelH, 6, 6, "F");
    setColor(this.doc, fg);
    this.doc.text(label, PAGE_W / 2, this.y, { align: "center" });
    this.y += 44;

    // Parties summary box
    const boxY = this.y;
    const boxH = 130;
    this.box(M_LEFT, boxY, CONTENT_W, boxH, C_SUBTLE);

    const colW = CONTENT_W / 2 - 12;
    this.y = boxY + 18;

    // Landlord column
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    setColor(this.doc, C_MUTED);
    this.doc.text("LANDLORD", M_LEFT + 16, this.y);

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    setColor(this.doc, C_TEXT);
    this.doc.text(a.owner_legal_name || "—", M_LEFT + 16, this.y + 18);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    setColor(this.doc, C_MUTED);
    if (a.owner_corporation_name) {
      this.doc.text(a.owner_corporation_name, M_LEFT + 16, this.y + 32);
    }
    if (a.owner_email) {
      this.doc.text(a.owner_email, M_LEFT + 16, this.y + 46);
    }
    if (a.owner_phone) {
      this.doc.text(a.owner_phone, M_LEFT + 16, this.y + 60);
    }

    // Tenant column
    const tx = M_LEFT + CONTENT_W / 2 + 4;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    setColor(this.doc, C_MUTED);
    this.doc.text("TENANT", tx, this.y);

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    setColor(this.doc, C_TEXT);
    this.doc.text(a.tenant_legal_name || "(Tenant fills upon signing)", tx, this.y + 18);

    if (a.tenant_email || a.tenant_phone) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      setColor(this.doc, C_MUTED);
      if (a.tenant_email) this.doc.text(a.tenant_email, tx, this.y + 32);
      if (a.tenant_phone) this.doc.text(a.tenant_phone, tx, this.y + 46);
    }

    this.y = boxY + boxH + 30;

    // Property line
    if (a.property_address) {
      setColor(this.doc, C_MUTED);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text("FOR THE PROPERTY AT", PAGE_W / 2, this.y, { align: "center" });
      this.y += 18;
      setColor(this.doc, C_TEXT);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      const addr = a.unit_number ? `${a.property_address} — Unit ${a.unit_number}` : a.property_address;
      const addrLines = this.doc.splitTextToSize(addr, CONTENT_W - 80);
      addrLines.forEach(line => {
        this.doc.text(line, PAGE_W / 2, this.y, { align: "center" });
        this.y += 14;
      });
    }

    this.y += 60;

    // Date footer line
    setColor(this.doc, C_MUTED);
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(9);
    this.doc.text(`Generated on ${fmtDate(a.created_at || new Date())}`, PAGE_W / 2, M_BOTTOM - 24, { align: "center" });
  }

  // ---------------- DETAIL SECTIONS ----------------
  drawDetailSections() {
    const a = this.agreement;
    this.newPage();

    // Section: Parties
    this.sectionHeader("Part 1 — The Parties");
    const halfW = (CONTENT_W - 16) / 2;
    const startY = this.y;
    const boxH = 160;

    // Landlord box
    this.box(M_LEFT, startY, halfW, boxH);
    this.y = startY + 14;
    const oldM = M_LEFT;
    const drawColumn = (xOffset, header, rows) => {
      const xLeft = M_LEFT + xOffset;
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      setColor(this.doc, C_MUTED);
      this.doc.text(header, xLeft + 12, startY + 16);
      let yy = startY + 32;
      rows.forEach(([label, val]) => {
        if (val == null || val === "") return;
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        setColor(this.doc, C_MUTED);
        this.doc.text(label, xLeft + 12, yy);
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        setColor(this.doc, C_TEXT);
        const valLines = this.doc.splitTextToSize(String(val), halfW - 24);
        this.doc.text(valLines, xLeft + 12, yy + 12);
        yy += Math.max(20, valLines.length * 12 + 6);
      });
    };

    drawColumn(0, "LANDLORD", [
      ["Legal Name", a.owner_legal_name],
      ["Corporation", a.owner_corporation_name],
      ["Email", a.owner_email],
      ["Phone", a.owner_phone],
      ["Mailing Address", a.owner_mailing_address],
    ]);

    // Tenant box
    this.box(M_LEFT + halfW + 16, startY, halfW, boxH);
    drawColumn(halfW + 16, "TENANT", [
      ["Legal Name", a.tenant_legal_name],
      ["Email", a.tenant_email],
      ["Phone", a.tenant_phone],
      ["Date of Birth", a.tenant_date_of_birth],
      ["Current Address", a.tenant_current_address],
      ["Employer", a.tenant_employer],
      ["Emergency Contact", a.tenant_emergency_contact_name],
      ["Emergency Phone", a.tenant_emergency_contact_phone],
    ]);

    this.y = startY + boxH + 16;

    // Section: Property
    this.sectionHeader("Part 2 — The Rental Unit");
    this.row("Property Address", a.property_address);
    this.row("Unit Number", a.unit_number);
    this.row("Property Type", a.property_type);
    this.row("Parking", a.parking_included ? `Included${a.parking_space ? ` — ${a.parking_space}` : ""}` : "Not included");
    this.row("Storage", a.storage_included ? "Included" : "Not included");
    if (a.utilities_included?.length) this.row("Utilities Included", a.utilities_included.join(", "));
    if (a.appliances_included?.length) this.row("Appliances Included", a.appliances_included.join(", "));

    // Section: Lease & Rent
    this.sectionHeader("Part 3 — Lease Term & Rent");
    this.row("Lease Type", a.lease_type === "fixed_term" ? "Fixed Term" : "Month-to-Month");
    this.row("Start Date", fmtDate(a.lease_start_date));
    this.row("End Date", fmtDate(a.lease_end_date));
    this.row("Monthly Rent", fmtMoney(a.rent_amount, a.currency));
    if (a.rent_due_day) {
      const suffix = ["st","nd","rd"][a.rent_due_day - 1] || "th";
      this.row("Rent Due Day", `${a.rent_due_day}${suffix} of each month`);
    }
    this.row("Payment Method", a.payment_method?.replace(/_/g, " "));
    if (a.deposit_amount > 0) {
      this.row("Security Deposit", fmtMoney(a.deposit_amount, a.currency));
      this.row("Deposit Held By", a.deposit_held_by);
    }
    this.row("Last Month Rent Collected", a.last_month_rent_collected ? "Yes" : "No");
    if (a.late_fee_amount > 0) {
      this.row("Late Fee", `${fmtMoney(a.late_fee_amount, a.currency)} after ${a.late_fee_grace_days || 0}-day grace period`);
    }

    // Section: Rules
    this.sectionHeader("Part 4 — Rules & Conditions");
    this.row("Smoking", a.smoking_permitted ? "Permitted" : "Not permitted");
    this.row("Pets", a.pets_permitted ? `Permitted${a.pet_details ? ` — ${a.pet_details}` : ""}` : "Not permitted");
    this.row("Subletting", a.subletting_permitted ? "Permitted with written consent" : "Not permitted");
    if (a.quiet_hours_start && a.quiet_hours_end) {
      this.row("Quiet Hours", `${a.quiet_hours_start} – ${a.quiet_hours_end}`);
    }
    if (a.guest_policy) this.row("Guest Policy", a.guest_policy);
    if (a.house_rules) {
      this.spacer(6);
      this.subHeader("House Rules");
      this.para(a.house_rules);
    }
    if (a.special_terms) {
      this.spacer(6);
      this.subHeader("Special Terms");
      this.para(a.special_terms);
    }
  }

  // ---------------- SIGNATURES PAGE ----------------
  drawSignatures() {
    const a = this.agreement;
    this.ensureSpace(220);
    this.sectionHeader("Part 5 — Signatures");

    const halfW = (CONTENT_W - 16) / 2;
    const startY = this.y;
    const boxH = 110;

    const drawSig = (xOffset, header, name, dateStr, ip) => {
      const x = M_LEFT + xOffset;
      this.box(x, startY, halfW, boxH, name ? C_SUBTLE : null);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      setColor(this.doc, C_MUTED);
      this.doc.text(header, x + 12, startY + 16);

      if (name) {
        // Cursive-ish: italic + larger
        this.doc.setFont("times", "italic");
        this.doc.setFontSize(18);
        setColor(this.doc, C_TEXT);
        const nameLines = this.doc.splitTextToSize(name, halfW - 24);
        this.doc.text(nameLines[0], x + 12, startY + 50);

        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        setColor(this.doc, C_MUTED);
        this.doc.text(`Signed: ${fmtDate(dateStr)}`, x + 12, startY + 80);
        if (ip) this.doc.text(`IP: ${ip}`, x + 12, startY + 92);
      } else {
        this.doc.setFont("helvetica", "italic");
        this.doc.setFontSize(10);
        setColor(this.doc, C_MUTED);
        this.doc.text("Awaiting signature", x + 12, startY + 50);
      }
    };

    drawSig(0, "LANDLORD SIGNATURE", a.owner_signature, a.owner_signed_at, a.owner_signed_ip);
    drawSig(halfW + 16, "TENANT SIGNATURE", a.tenant_signature, a.tenant_signed_at, a.tenant_signed_ip);

    this.y = startY + boxH + 24;

    // Legal disclaimer
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(8);
    setColor(this.doc, C_MUTED);
    const disclaimer = "This agreement was electronically signed by both parties. The signatures, IP addresses and timestamps above constitute an audit trail per applicable e-signature legislation in the governing jurisdiction. This document does not constitute legal advice.";
    const lines = this.doc.splitTextToSize(disclaimer, CONTENT_W);
    lines.forEach(line => {
      this.ensureSpace(12);
      this.doc.text(line, M_LEFT, this.y);
      this.y += 11;
    });
  }

  // ---------------- TENANT ID DOCUMENTS (embedded as image pages) ----------------
  // Each image gets its own page with a small caption. Returns a Promise because
  // image loading is async.
  async drawTenantDocs() {
    const docs = this.agreement.tenant_id_documents || [];
    if (!docs.length) return;

    // Filter to images only — PDFs/etc. listed at the end.
    const imageExts = /\.(png|jpe?g|gif|webp)$/i;
    const isImage = (d) => imageExts.test(d.filename || d.path || d.url || "");
    const images = docs.filter(isImage);
    const nonImages = docs.filter(d => !isImage(d));

    const typeLabel = (t) => ({
      id_card: "Government ID Card",
      passport: "Passport",
      drivers_license: "Driver's License",
    }[t] || t || "ID Document");

    for (const d of images) {
      try {
        const dataUrl = await fetchAsDataUrl(d.url);
        if (!dataUrl) continue;
        this.newPage();

        // Header
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(11);
        setColor(this.doc, C_TEXT);
        this.doc.text("TENANT ID VERIFICATION", M_LEFT, this.y);
        this.y += 16;

        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(10);
        setColor(this.doc, C_MUTED);
        this.doc.text(typeLabel(d.type), M_LEFT, this.y);
        this.y += 14;
        if (d.filename) {
          this.doc.setFontSize(8);
          this.doc.text(d.filename, M_LEFT, this.y);
          this.y += 10;
        }
        if (d.uploaded_at) {
          this.doc.setFontSize(8);
          this.doc.text(`Uploaded ${fmtDate(d.uploaded_at)}`, M_LEFT, this.y);
          this.y += 14;
        }

        // Image — fit within content area
        const maxW = CONTENT_W;
        const maxH = M_BOTTOM - this.y - 24;
        const dims = await getImageDims(dataUrl);
        let dw = maxW;
        let dh = (dims.h / dims.w) * dw;
        if (dh > maxH) {
          dh = maxH;
          dw = (dims.w / dims.h) * dh;
        }
        const dx = M_LEFT + (maxW - dw) / 2;
        const dy = this.y;
        // jsPDF auto-detects PNG/JPEG from data URL
        this.doc.addImage(dataUrl, "AUTO", dx, dy, dw, dh, undefined, "FAST");
      } catch (err) {
        console.warn("[RentalAgreementPdf] failed to embed image", d, err);
      }
    }

    // Non-images listed
    if (nonImages.length) {
      this.newPage();
      this.sectionHeader("Tenant Verification Documents (External)");
      this.para("The following tenant ID documents were uploaded but cannot be embedded in this PDF (non-image formats). They are accessible via signed URLs in the platform.");
      nonImages.forEach((d, i) => {
        this.row(`Document ${i + 1}`, `${typeLabel(d.type)} — ${d.filename || "(no filename)"}`);
      });
    }
  }

  // ---------------- FOOTERS ----------------
  // Run after all content is added. Adds page numbers + agreement number per page.
  applyFooters() {
    const a = this.agreement;
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      setColor(this.doc, C_MUTED);
      const agNum = `Agreement #${fmtAgreementNumber(a.agreement_number)}`;
      const formVer = a.form_version ? ` · ${a.form_version}` : "";
      const pageStr = `Page ${i} of ${total}`;
      this.doc.text(`${agNum}${formVer}`, M_LEFT, M_BOTTOM + 24);
      this.doc.text(pageStr, M_RIGHT, M_BOTTOM + 24, { align: "right" });
      // top-right header on every page (except cover)
      if (i > 1) {
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        setColor(this.doc, C_MUTED);
        this.doc.text(`Residential Tenancy Agreement #${fmtAgreementNumber(a.agreement_number)}`, M_RIGHT, 32, { align: "right" });
        setDraw(this.doc, C_RULE);
        this.doc.setLineWidth(0.5);
        this.doc.line(M_LEFT, 38, M_RIGHT, 38);
      }
    }
  }

  // ---------------- BUILD ----------------
  async build() {
    this.drawCoverPage();
    this.drawDetailSections();
    this.drawSignatures();
    await this.drawTenantDocs();
    this.applyFooters();
    return this.doc;
  }
}

// Fetch a remote image and return it as a data URL.
// Uses fetch -> blob -> FileReader.
async function fetchAsDataUrl(url) {
  if (!url) return null;
  // If it's already a data URL, return as-is
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("fetchAsDataUrl failed:", err);
    return null;
  }
}

// Read intrinsic image dimensions from a data URL by loading it into an Image.
function getImageDims(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Build and download a rental agreement PDF.
 * Returns the file name on success.
 */
export async function downloadRentalAgreementPdf(agreement) {
  if (!agreement) throw new Error("No agreement provided");
  const builder = new PdfBuilder(agreement);
  const doc = await builder.build();
  const numStr = fmtAgreementNumber(agreement.agreement_number);
  const slug = (agreement.listing_title || "agreement").replace(/\s+/g, "-").toLowerCase();
  const fileName = `rental-agreement-${numStr}-${slug}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Build and return the PDF as a Blob (for upload, etc.).
 */
export async function buildRentalAgreementPdfBlob(agreement) {
  const builder = new PdfBuilder(agreement);
  const doc = await builder.build();
  return doc.output("blob");
}
