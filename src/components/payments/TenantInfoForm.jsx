/**
 * TenantInfoForm — tenant's personal information section.
 * Used inside RentalAgreementView when status = pending_tenant.
 *
 * All fields required (per landlord directive). On submit, parent saves
 * these along with the typed signature.
 */
import React from "react";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";

export default function TenantInfoForm({ value, onChange }) {
  const v = value || {};
  const set = (key, val) => onChange?.({ ...v, [key]: val });

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border pb-2 mb-2">
        <User className="w-4 h-4" />
        Your Information (Required)
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Legal Name *</label>
          <Input value={v.tenant_legal_name || ""} onChange={e => set("tenant_legal_name", e.target.value)} placeholder="As on government ID" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone *</label>
          <Input type="tel" value={v.tenant_phone || ""} onChange={e => set("tenant_phone", e.target.value)} placeholder="+1 (xxx) xxx-xxxx" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date of Birth *</label>
          <Input type="date" value={v.tenant_date_of_birth || ""} onChange={e => set("tenant_date_of_birth", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Address *</label>
        <Input value={v.tenant_current_address || ""} onChange={e => set("tenant_current_address", e.target.value)} placeholder="Street, city, province/state, postal/zip" />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employer *</label>
        <Input value={v.tenant_employer || ""} onChange={e => set("tenant_employer", e.target.value)} placeholder="Company name (or Self-employed / Student / Retired)" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact Name *</label>
          <Input value={v.tenant_emergency_contact_name || ""} onChange={e => set("tenant_emergency_contact_name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact Phone *</label>
          <Input type="tel" value={v.tenant_emergency_contact_phone || ""} onChange={e => set("tenant_emergency_contact_phone", e.target.value)} />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Your information is shared only with the landlord on this agreement. Used for tenancy records and identity verification.
      </p>
    </div>
  );
}

/**
 * Returns null if all required tenant fields are filled, else returns
 * a string describing the first missing field. Used by parent for validation.
 */
export function validateTenantInfo(v) {
  if (!v) return "Please fill in your information";
  const required = [
    { key: "tenant_legal_name", label: "Full Legal Name" },
    { key: "tenant_phone", label: "Phone" },
    { key: "tenant_date_of_birth", label: "Date of Birth" },
    { key: "tenant_current_address", label: "Current Address" },
    { key: "tenant_employer", label: "Employer" },
    { key: "tenant_emergency_contact_name", label: "Emergency Contact Name" },
    { key: "tenant_emergency_contact_phone", label: "Emergency Contact Phone" },
  ];
  for (const f of required) {
    if (!String(v[f.key] || "").trim()) return `${f.label} is required`;
  }
  return null;
}
