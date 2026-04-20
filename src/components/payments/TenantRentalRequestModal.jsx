/**
 * Tenant submits a rental application / request to move in.
 * Multi-step form collecting all legally required tenant info.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entities, uploadFile } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Loader2, ChevronRight, ChevronLeft, FileText, Upload } from "lucide-react";

const STEPS = ["Move-In Details", "Personal Info", "ID Documents"];

export default function TenantRentalRequestModal({ open, onOpenChange, listing, existingRequest }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    move_in_date: existingRequest?.lease_start_date || "",
    lease_length_months: "12",
    tenant_legal_name: existingRequest?.tenant_legal_name || user?.full_name || "",
    tenant_email: existingRequest?.tenant_email || user?.id || "",
    tenant_phone: existingRequest?.tenant_phone || "",
    tenant_date_of_birth: existingRequest?.tenant_date_of_birth || "",
    tenant_employer: existingRequest?.tenant_employer || "",
    tenant_current_address: existingRequest?.tenant_current_address || "",
    tenant_emergency_contact_name: existingRequest?.tenant_emergency_contact_name || "",
    tenant_emergency_contact_phone: existingRequest?.tenant_emergency_contact_phone || "",
    tenant_id_documents: existingRequest?.tenant_id_documents || [],
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const docType = e.target.dataset.doctype || "id_card";
    setUploading(true);
    const { file_url } = await uploadFile(file, 'verification-docs');
    setUploading(false);
    setForm(f => ({
      ...f,
      tenant_id_documents: [
        ...f.tenant_id_documents.filter(d => d.document_type !== docType),
        { document_type: docType, file_url, uploaded_at: new Date().toISOString() },
      ],
    }));
    toast.success("Document uploaded.");
  };

  const handleSubmit = async () => {
    if (!form.move_in_date) { toast.error("Please select a move-in date."); return; }
    if (!form.tenant_legal_name) { toast.error("Legal name is required."); return; }
    if (form.tenant_id_documents.length === 0) { toast.error("Please upload at least one ID document."); return; }

    setLoading(true);
    try {
      if (existingRequest?.id) {
        await entities.RentalAgreement.update(existingRequest.id, { ...form, status: 'pending_owner' });
      } else {
        await entities.RentalAgreement.create({
          listing_id: listing.id,
          listing_title: listing.title,
          owner_user_id: listing.owner_user_id,
          tenant_user_id: user.id,
          status: 'pending_owner',
          ...form,
        });
      }
      await entities.Notification.create({
        user_id: listing.owner_user_id,
        type: 'rental_request',
        title: '📋 New Rental Request',
        body: `${form.tenant_legal_name || 'A tenant'} has sent a rental request for ${listing.title}`,
        read: false,
      });
      toast.success("Rental request sent! The owner will be notified.");
      onOpenChange(false);
      setStep(0);
    } catch (err) {
      toast.error(err.message || "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  const docTypes = [
    { value: "passport", label: "Passport" },
    { value: "driver_license", label: "Driver's License" },
    { value: "id_card", label: "Government ID Card" },
  ];

  const stepContent = [
    // Step 0: Move-in details
    <div key="s0" className="space-y-4">
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">{listing?.title}</p>
        <p>{[listing?.city, listing?.province_or_state].filter(Boolean).join(", ")}</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desired Move-In Date *</label>
        <Input type="date" value={form.move_in_date} onChange={e => set("move_in_date", e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desired Lease Length</label>
        <Select value={form.lease_length_months} onValueChange={v => set("lease_length_months", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 month</SelectItem>
            <SelectItem value="3">3 months</SelectItem>
            <SelectItem value="6">6 months</SelectItem>
            <SelectItem value="12">12 months</SelectItem>
            <SelectItem value="24">24 months</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>,

    // Step 1: Personal info
    <div key="s1" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Legal Name *</label>
          <Input value={form.tenant_legal_name} onChange={e => set("tenant_legal_name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date of Birth *</label>
          <Input type="date" value={form.tenant_date_of_birth} onChange={e => set("tenant_date_of_birth", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
          <Input type="email" value={form.tenant_email} onChange={e => set("tenant_email", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone *</label>
          <Input placeholder="+1 (xxx) xxx-xxxx" value={form.tenant_phone} onChange={e => set("tenant_phone", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Address *</label>
        <Input placeholder="123 Main St, City, Province" value={form.tenant_current_address} onChange={e => set("tenant_current_address", e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employer / Occupation *</label>
        <Input placeholder="e.g. Software Engineer at Acme Corp" value={form.tenant_employer} onChange={e => set("tenant_employer", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact Name *</label>
          <Input value={form.tenant_emergency_contact_name} onChange={e => set("tenant_emergency_contact_name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact Phone *</label>
          <Input value={form.tenant_emergency_contact_phone} onChange={e => set("tenant_emergency_contact_phone", e.target.value)} />
        </div>
      </div>
    </div>,

    // Step 2: ID documents
    <div key="s2" className="space-y-4">
      <p className="text-sm text-muted-foreground">Upload at least one government-issued ID for identity verification. <span className="text-destructive font-medium">*</span></p>
      {docTypes.map(({ value, label }) => {
        const uploaded = form.tenant_id_documents.find(d => d.document_type === value);
        return (
          <div key={value} className="border border-border rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{label}</p>
              {uploaded && <p className="text-xs text-accent mt-0.5">✓ Uploaded</p>}
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*,.pdf" data-doctype={value} onChange={handleFileUpload} className="hidden" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${uploaded ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground hover:border-accent/50"}`}>
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {uploaded ? "Replace" : "Upload"}
              </div>
            </label>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Your documents are stored securely and only shared with the landlord.</p>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-secondary" />
            Send Rental Request
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-secondary" : "bg-muted"}`} />
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
              if (step === 0) {
                if (!form.move_in_date) { toast.error("Please select a move-in date."); return; }
              }
              if (step === 1) {
                if (!form.tenant_legal_name.trim()) { toast.error("Full legal name is required."); return; }
                if (!form.tenant_date_of_birth) { toast.error("Date of birth is required."); return; }
                if (!form.tenant_email.trim()) { toast.error("Email is required."); return; }
                if (!form.tenant_phone.trim()) { toast.error("Phone number is required."); return; }
                if (!form.tenant_current_address.trim()) { toast.error("Current address is required."); return; }
                if (!form.tenant_employer.trim()) { toast.error("Employer / Occupation is required."); return; }
                if (!form.tenant_emergency_contact_name.trim()) { toast.error("Emergency contact name is required."); return; }
                if (!form.tenant_emergency_contact_phone.trim()) { toast.error("Emergency contact phone is required."); return; }
              }
              setStep(s => s + 1);
            }} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}