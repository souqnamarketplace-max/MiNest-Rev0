/**
 * Owner sends a formal rental offer to a specific tenant.
 * Multi-step form collecting all legally required fields.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Loader2, ChevronRight, ChevronLeft, FileText } from "lucide-react";

const STEPS = ["Landlord Info", "Property & Lease", "Financial Terms", "Rules & Extras"];

const PROVINCES = ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Nova Scotia","Ontario","Prince Edward Island","Quebec","Saskatchewan"];
const US_STATES = ["California","Florida","New York","Texas","Washington"];

export default function RentalOfferModal({ open, onOpenChange, listing, tenantUserId, tenantName, agreement }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    owner_legal_name: user?.full_name || "",
    owner_email: user?.id || "",
    owner_phone: "",
    owner_mailing_address: "",
    owner_corporation_name: "",
    unit_number: listing?.unit_number || "",
    property_type: listing?.listing_type || "apartment",
    governing_province_or_state: listing?.province_or_state || "",
    country: listing?.country || "CA",
    lease_start_date: "",
    lease_end_date: "",
    lease_type: "fixed_term",
    parking_included: false,
    parking_space: "",
    storage_included: false,
    utilities_included: [],
    appliances_included: [],
    rent_due_day: 1,
    payment_method: "in_app",
    deposit_amount: "",
    deposit_held_by: "",
    last_month_rent_collected: false,
    late_fee_amount: "",
    late_fee_grace_days: 5,
    smoking_permitted: false,
    pets_permitted: false,
    pet_details: "",
    subletting_permitted: false,
    house_rules: "",
    guest_policy: "",
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    special_terms: "",
    tenant_user_id_input: tenantUserId || "",
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const toggleArr = (key, val) => setForm(f => ({
    ...f,
    [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
  }));

  const handleSubmit = async () => {
    const rawTenant = tenantUserId || form.tenant_user_id_input;
    // SECURITY: Validate and sanitize tenant input before DB query
    const targetTenant = typeof rawTenant === 'string' ? rawTenant.trim().slice(0, 255) : null;
    if (!targetTenant) { toast.error("Please enter a tenant email."); return; }
    if (!form.lease_start_date || !form.lease_end_date) { toast.error("Lease dates are required."); return; }

    setLoading(true);
    try {
      // Find tenant user profile by email or userId
      let tenantId = targetTenant;
      if (targetTenant.includes('@')) {
        const { supabase } = await import('@/lib/supabase');
        const { data: users } = await supabase.from('user_profiles').select('user_id').ilike('full_name', `%${targetTenant}%`).limit(1);
        // Try to find by searching - for now use as-is
      }
      await entities.RentalAgreement.create({
        listing_id: listing.id,
        listing_title: listing.title,
        owner_user_id: user.id,
        tenant_user_id: tenantId,
        status: 'pending_tenant',
        ...form,
        deposit_amount: form.deposit_amount ? Math.round(parseFloat(form.deposit_amount) * 100) : 0,
        late_fee_amount: form.late_fee_amount ? Math.round(parseFloat(form.late_fee_amount) * 100) : 0,
      });
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
      toast.error(err.message || "Failed to send offer.");
    } finally {
      setLoading(false);
    }
  };

  const UTILITY_OPTIONS = ["heat", "water", "electricity", "gas", "internet", "cable"];
  const APPLIANCE_OPTIONS = ["fridge", "stove", "dishwasher", "washer", "dryer", "microwave", "air conditioning"];

  const stepContent = [
    // Step 0: Landlord Info
    <div key="s0" className="space-y-3">
      {!tenantUserId && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant Email *</label>
          <Input placeholder="tenant@email.com" value={form.tenant_user_id_input} onChange={e => set("tenant_user_id_input", e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legal Name *</label>
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone <span className="text-destructive">*</span></label>
          <Input placeholder="+1 (xxx) xxx-xxxx" value={form.owner_phone} onChange={e => set("owner_phone", e.target.value)} className={!form.owner_phone.trim() ? "border-destructive" : ""} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mailing Address (if different)</label>
        <Input placeholder="123 Main St, City, Province" value={form.owner_mailing_address} onChange={e => set("owner_mailing_address", e.target.value)} />
      </div>
    </div>,

    // Step 1: Property & Lease
    <div key="s1" className="space-y-3">
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</label>
          <Select value={form.country} onValueChange={v => set("country", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Province / State</label>
          <Select value={form.governing_province_or_state} onValueChange={v => set("governing_province_or_state", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {(form.country === "CA" ? PROVINCES : US_STATES).map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
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

    // Step 2: Financial Terms
    <div key="s2" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Security Deposit ($)</label>
          <Input type="number" placeholder="0.00" value={form.deposit_amount} onChange={e => set("deposit_amount", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deposit Held By</label>
          <Input placeholder="Landlord name / trust" value={form.deposit_held_by} onChange={e => set("deposit_held_by", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rent Due Day (1–28)</label>
          <Input type="number" min={1} max={28} value={form.rent_due_day} onChange={e => set("rent_due_day", parseInt(e.target.value))} />
        </div>
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Late Fee ($)</label>
          <Input type="number" placeholder="0.00" value={form.late_fee_amount} onChange={e => set("late_fee_amount", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grace Period (days)</label>
          <Input type="number" min={1} max={30} value={form.late_fee_grace_days} onChange={e => set("late_fee_grace_days", parseInt(e.target.value))} />
        </div>
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

    // Step 3: Rules & Extras
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
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quiet Hours</label>
        <div className="flex items-center gap-2">
          <Input type="time" value={form.quiet_hours_start} onChange={e => set("quiet_hours_start", e.target.value)} className="flex-1" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="time" value={form.quiet_hours_end} onChange={e => set("quiet_hours_end", e.target.value)} className="flex-1" />
        </div>
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
            <React.Fragment key={i}>
              <div className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-muted"}`} />
            </React.Fragment>
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
              setStep(s => s + 1);
            }} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              Send Offer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}