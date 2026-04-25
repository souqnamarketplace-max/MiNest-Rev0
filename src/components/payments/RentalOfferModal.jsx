/**
 * Owner sends a formal rental offer to a specific tenant.
 * Multi-step form — LANDLORD-ONLY fields. Tenant fills personal info + signs separately.
 *
 * Zip 1.5 changes:
 *   - Removed all tenant_* personal fields (tenant fills these on their side)
 *   - Quiet hours now OPTIONAL via checkbox
 *   - Landlord signs at the end of step 4 (status remains 'pending_tenant',
 *     but owner_signature is pre-filled — Facebook/Instagram-style send-with-signature)
 *   - Better column-name handling (uses listing.street_address, listing.parking_type)
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entities } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Loader2, ChevronRight, ChevronLeft, FileText, CheckCircle2 } from "lucide-react";
import JurisdictionPicker from "@/components/payments/JurisdictionPicker";
import { detectJurisdictionFromListing, getFormVersion, findJurisdiction } from "@/lib/jurisdictions";

const STEPS = ["Your Info", "Property & Lease", "Financial Terms", "Rules & Sign"];

// Best-effort IP capture for audit trail. Does not block on failure.
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

export default function RentalOfferModal({ open, onOpenChange, listing, tenantUserId, tenantName }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const detected = detectJurisdictionFromListing(listing);

  const [form, setForm] = useState({
    // Landlord info
    owner_legal_name: user?.full_name || "",
    owner_email: user?.email || "",
    owner_phone: "",
    owner_mailing_address: "",
    owner_corporation_name: "",

    // Property
    unit_number: "",
    property_type: listing?.listing_type || "apartment",
    property_address: [listing?.street_address, listing?.city, listing?.province_or_state].filter(Boolean).join(", ") || "",

    // Jurisdiction
    governing_province_or_state: detected.jurisdiction?.code || listing?.province_or_state || "",
    governing_province_name: detected.jurisdiction?.name || listing?.province_or_state || "",
    country: detected.country || (listing?.country || "CA"),
    currency: detected.country === "US" ? "usd" : "cad",

    // Lease
    lease_start_date: "",
    lease_end_date: "",
    lease_type: "fixed_term",

    // Property features
    parking_included: !!(listing?.parking_type && listing.parking_type !== 'none'),
    parking_space: "",
    storage_included: false,
    utilities_included: [],
    appliances_included: [],

    // Financial
    rent_amount: listing?.rent_amount || "",
    interval: "month",
    rent_due_day: 1,
    payment_method: "in_app",
    deposit_amount: "",
    deposit_held_by: "",
    last_month_rent_collected: false,
    late_fee_amount: "",
    late_fee_grace_days: 5,

    // Rules
    smoking_permitted: false,
    pets_permitted: !!listing?.pets_allowed,
    pet_details: "",
    subletting_permitted: false,
    house_rules: "",
    guest_policy: "",
    quiet_hours_enabled: false,        // NEW — optional toggle
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    special_terms: "",

    // Landlord signature (typed at end of form)
    owner_signature: "",

    // Tenant identifier (resolved to UUID on submit)
    tenant_user_id_input: tenantUserId || "",
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const toggleArr = (key, val) => setForm(f => ({
    ...f,
    [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
  }));

  const handleJurisdictionChange = ({ country, jurisdictionCode, jurisdictionName }) => {
    setForm(f => ({
      ...f,
      country,
      governing_province_or_state: jurisdictionCode,
      governing_province_name: jurisdictionName,
      currency: country === "US" ? "usd" : "cad",
    }));
  };

  const resolveTenantUserId = async (raw) => {
    const val = typeof raw === 'string' ? raw.trim() : '';
    if (!val) return null;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(val)) return val;
    if (val.includes('@')) {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id')
        .ilike('email', val)
        .limit(1);
      if (data && data.length > 0) return data[0].user_id;
      return null;
    }
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id')
      .or(`display_name.ilike.%${val}%,full_name.ilike.%${val}%`)
      .limit(1);
    if (data && data.length > 0) return data[0].user_id;
    return null;
  };

  const handleSubmit = async () => {
    const rawTenant = tenantUserId || form.tenant_user_id_input;
    const targetTenant = typeof rawTenant === 'string' ? rawTenant.trim().slice(0, 255) : null;
    if (!targetTenant) { toast.error("Please enter a tenant email."); return; }
    if (!form.lease_start_date || !form.lease_end_date) { toast.error("Lease dates are required."); return; }
    if (!form.country || !form.governing_province_or_state) { toast.error("Please select the governing country and province/state."); return; }
    if (!form.rent_amount || Number(form.rent_amount) <= 0) { toast.error("Please enter a monthly rent amount."); return; }
    if (!form.owner_signature.trim()) { toast.error("Please type your full legal name to sign and send the offer."); return; }
    if (form.owner_signature.trim().toLowerCase() !== (form.owner_legal_name || '').trim().toLowerCase()) {
      toast.error("Your signature must match your legal name exactly.");
      return;
    }

    setLoading(true);
    try {
      const tenantId = await resolveTenantUserId(targetTenant);
      if (!tenantId) {
        toast.error("Could not find a user with that email. Ask them to sign up first.");
        setLoading(false);
        return;
      }

      const jurisdiction = findJurisdiction(form.country, form.governing_province_or_state);
      const form_version = getFormVersion(form.country, form.governing_province_or_state);
      const ip = await getClientIp();

      // Build payload — skip empty quiet hours when disabled
      const payload = {
        listing_id: listing.id,
        listing_title: listing.title,
        owner_user_id: user.id,
        tenant_user_id: tenantId,
        status: 'pending_tenant',
        form_version,

        // Landlord info
        owner_legal_name: form.owner_legal_name,
        owner_email: form.owner_email,
        owner_phone: form.owner_phone,
        owner_mailing_address: form.owner_mailing_address,
        owner_corporation_name: form.owner_corporation_name,

        // Property
        unit_number: form.unit_number,
        property_type: form.property_type,
        property_address: form.property_address,

        // Jurisdiction (store full name for display)
        governing_province_or_state: jurisdiction?.name || form.governing_province_or_state,
        country: form.country,
        currency: form.currency,

        // Lease
        lease_start_date: form.lease_start_date,
        lease_end_date: form.lease_end_date,
        lease_type: form.lease_type,

        // Features
        parking_included: form.parking_included,
        parking_space: form.parking_included ? form.parking_space : '',
        storage_included: form.storage_included,
        utilities_included: form.utilities_included,
        appliances_included: form.appliances_included,

        // Financial — convert to cents
        rent_amount: form.rent_amount ? Math.round(parseFloat(form.rent_amount) * 100) : 0,
        interval: form.interval,
        rent_due_day: form.rent_due_day,
        payment_method: form.payment_method,
        deposit_amount: form.deposit_amount ? Math.round(parseFloat(form.deposit_amount) * 100) : 0,
        deposit_held_by: form.deposit_held_by,
        last_month_rent_collected: form.last_month_rent_collected,
        late_fee_amount: form.late_fee_amount ? Math.round(parseFloat(form.late_fee_amount) * 100) : 0,
        late_fee_grace_days: form.late_fee_grace_days,

        // Rules
        smoking_permitted: form.smoking_permitted,
        pets_permitted: form.pets_permitted,
        pet_details: form.pets_permitted ? form.pet_details : '',
        subletting_permitted: form.subletting_permitted,
        house_rules: form.house_rules,
        guest_policy: form.guest_policy,
        quiet_hours_start: form.quiet_hours_enabled ? form.quiet_hours_start : null,
        quiet_hours_end: form.quiet_hours_enabled ? form.quiet_hours_end : null,
        special_terms: form.special_terms,

        // Landlord signature (sign-on-send)
        owner_signature: form.owner_signature.trim(),
        owner_signed_at: new Date().toISOString(),
        owner_signed_ip: ip,
        owner_signed_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null)?.slice(0, 500),

        // Offer expires in 7 days by default
        offer_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await entities.RentalAgreement.create(payload);

      await entities.Notification.create({
        user_id: tenantId,
        type: 'rental_offer',
        title: '🏠 New Rental Offer',
        body: `You have received a rental offer for ${listing.title}`,
        read: false,
      });
      toast.success("Rental offer sent! The tenant will be notified.");
      onOpenChange(false);
      setStep(0);
    } catch (err) {
      console.error('[RentalOfferModal] create failed:', err);
      toast.error(err.message || "Failed to send offer.");
    } finally {
      setLoading(false);
    }
  };

  const UTILITY_OPTIONS = ["heat", "water", "electricity", "gas", "internet", "cable"];
  const APPLIANCE_OPTIONS = ["fridge", "stove", "dishwasher", "washer", "dryer", "microwave", "air conditioning"];

  const stepContent = [
    /* Step 0: Your Info (landlord) */
    <div key="s0" className="space-y-3">
      {!tenantUserId && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant Email *</label>
          <Input placeholder="tenant@email.com" value={form.tenant_user_id_input} onChange={e => set("tenant_user_id_input", e.target.value)} />
          <p className="text-[10px] text-muted-foreground mt-1">Tenant must already have a MiNest account.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Legal Name *</label>
          <Input value={form.owner_legal_name} onChange={e => set("owner_legal_name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Corporation (if any)</label>
          <Input placeholder="Optional" value={form.owner_corporation_name} onChange={e => set("owner_corporation_name", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
          <Input type="email" value={form.owner_email} onChange={e => set("owner_email", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone *</label>
          <Input placeholder="+1 (xxx) xxx-xxxx" value={form.owner_phone} onChange={e => set("owner_phone", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mailing Address (if different)</label>
        <Input placeholder="123 Main St, City, Province" value={form.owner_mailing_address} onChange={e => set("owner_mailing_address", e.target.value)} />
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
        💡 The tenant will fill in <strong className="text-foreground">their personal information</strong> (full name, date of birth, phone, current address, employer, emergency contact) and upload their ID/passport when they receive this offer to sign.
      </div>
    </div>,

    /* Step 1: Property & Lease */
    <div key="s1" className="space-y-3">
      <JurisdictionPicker
        country={form.country}
        jurisdictionCode={form.governing_province_or_state}
        onChange={handleJurisdictionChange}
        listing={listing}
      />
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Address *</label>
        <Input placeholder="123 Main St, City" value={form.property_address} onChange={e => set("property_address", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit Number</label>
          <Input placeholder="e.g. 4B" value={form.unit_number} onChange={e => set("unit_number", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Type</label>
          <Select value={form.property_type} onValueChange={v => set("property_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["apartment","house","condo","room","basement","townhouse"].map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease Start *</label>
          <Input type="date" value={form.lease_start_date} onChange={e => set("lease_start_date", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease End *</label>
          <Input type="date" value={form.lease_end_date} onChange={e => set("lease_end_date", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease Type</label>
        <Select value={form.lease_type} onValueChange={v => set("lease_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed_term">Fixed Term</SelectItem>
            <SelectItem value="month_to_month">Month-to-Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Utilities Included</label>
        <div className="flex flex-wrap gap-2">
          {UTILITY_OPTIONS.map(u => (
            <button key={u} type="button"
              onClick={() => toggleArr("utilities_included", u)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.utilities_included.includes(u) ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:border-accent/50"}`}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Appliances Included</label>
        <div className="flex flex-wrap gap-2">
          {APPLIANCE_OPTIONS.map(a => (
            <button key={a} type="button"
              onClick={() => toggleArr("appliances_included", a)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.appliances_included.includes(a) ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:border-accent/50"}`}>
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>,

    /* Step 2: Financial Terms */
    <div key="s2" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Monthly Rent ({form.currency?.toUpperCase() || "CAD"}) *
          </label>
          <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.rent_amount} onChange={e => set("rent_amount", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rent Due Day (1–28)</label>
          <Input type="number" min={1} max={28} value={form.rent_due_day} onChange={e => set("rent_due_day", parseInt(e.target.value, 10) || 1)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Security Deposit ({form.currency?.toUpperCase()})</label>
          <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.deposit_amount} onChange={e => set("deposit_amount", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deposit Held By</label>
          <Input placeholder="Landlord / trust account" value={form.deposit_held_by} onChange={e => set("deposit_held_by", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</label>
          <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in_app">In-App (Stripe)</SelectItem>
              <SelectItem value="e_transfer">E-Transfer</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grace Period (days)</label>
          <Input type="number" min={0} max={30} value={form.late_fee_grace_days} onChange={e => set("late_fee_grace_days", parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Late Fee ({form.currency?.toUpperCase()})</label>
        <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.late_fee_amount} onChange={e => set("late_fee_amount", e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4">
        {[
          { key: "last_month_rent_collected", label: "Last Month Rent Collected" },
          { key: "parking_included", label: "Parking Included" },
          { key: "storage_included", label: "Storage Included" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} className="rounded" />
            {label}
          </label>
        ))}
      </div>
      {form.parking_included && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parking Space</label>
          <Input placeholder="e.g. Spot #12" value={form.parking_space} onChange={e => set("parking_space", e.target.value)} />
        </div>
      )}
    </div>,

    /* Step 3: Rules + Sign */
    <div key="s3" className="space-y-3">
      <div className="flex flex-wrap gap-4">
        {[
          { key: "smoking_permitted", label: "Smoking Permitted" },
          { key: "pets_permitted", label: "Pets Permitted" },
          { key: "subletting_permitted", label: "Subletting Permitted" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} className="rounded" />
            {label}
          </label>
        ))}
      </div>
      {form.pets_permitted && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pet Details</label>
          <Input placeholder="e.g. One small dog under 20lbs" value={form.pet_details} onChange={e => set("pet_details", e.target.value)} />
        </div>
      )}

      {/* Quiet hours — OPTIONAL */}
      <div className="border border-border rounded-lg p-3 bg-muted/20">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.quiet_hours_enabled}
            onChange={e => set("quiet_hours_enabled", e.target.checked)}
            className="rounded"
          />
          <span className="font-medium">Set quiet hours (optional)</span>
        </label>
        {form.quiet_hours_enabled && (
          <div className="mt-3 flex items-center gap-2">
            <Input type="time" value={form.quiet_hours_start} onChange={e => set("quiet_hours_start", e.target.value)} className="flex-1" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="time" value={form.quiet_hours_end} onChange={e => set("quiet_hours_end", e.target.value)} className="flex-1" />
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">House Rules</label>
        <Textarea placeholder="No parties, no smoking in common areas..." value={form.house_rules} onChange={e => set("house_rules", e.target.value)} className="min-h-16 text-sm" />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Guest Policy</label>
        <Input placeholder="e.g. Guests allowed up to 7 consecutive nights" value={form.guest_policy} onChange={e => set("guest_policy", e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Special Terms</label>
        <Textarea placeholder="Any additional clauses or conditions..." value={form.special_terms} onChange={e => set("special_terms", e.target.value)} className="min-h-16 text-sm" />
      </div>

      {/* Landlord signature — sign on send */}
      <div className="border-2 border-accent/30 rounded-xl p-4 bg-accent/5 mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          Sign and send this offer
        </div>
        <p className="text-xs text-muted-foreground">
          Type your full legal name (<strong className="text-foreground">{form.owner_legal_name || "as entered above"}</strong>) to electronically sign this offer. Your IP address and timestamp will be recorded for legal audit.
        </p>
        <Input
          placeholder={`Type "${form.owner_legal_name || "your full legal name"}" to sign`}
          value={form.owner_signature}
          onChange={e => set("owner_signature", e.target.value)}
          className="bg-white"
        />
      </div>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Send Rental Offer {tenantName ? `to ${tenantName}` : ""}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-muted"}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4 font-medium">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

        {stepContent[step]}

        <div className="flex gap-2 pt-4">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => {
              if (step === 0 && !form.owner_phone.trim()) {
                toast.error("Phone number is required.");
                return;
              }
              if (step === 1) {
                if (!form.country || !form.governing_province_or_state) {
                  toast.error("Please select the governing country and province/state.");
                  return;
                }
                if (!form.lease_start_date || !form.lease_end_date) {
                  toast.error("Lease start and end dates are required.");
                  return;
                }
              }
              setStep(s => s + 1);
            }} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              Sign and Send Offer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
