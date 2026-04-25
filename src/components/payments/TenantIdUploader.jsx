/**
 * TenantIdUploader — uploads tenant ID/passport documents to the existing
 * verification-docs bucket and returns the array of uploaded document refs.
 *
 * Storage path: rental_agreement/{agreement_id}/{user_id}/{type}-{timestamp}.{ext}
 * Each uploaded doc returns: { type, url, uploaded_at }
 *
 * Supported types: id_card, passport, drivers_license
 * Max size per file: 10MB
 * Accepted formats: image/* and application/pdf
 */
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Upload, FileCheck, X, Loader2 } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED = "image/*,application/pdf";
const DOC_TYPES = [
  { value: "id_card", label: "Government ID Card" },
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
];

export default function TenantIdUploader({ agreementId, value = [], onChange }) {
  const { user } = useAuth();
  const fileInput = useRef(null);
  const [docType, setDocType] = useState("id_card");
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file || !user?.id || !agreementId) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Max 10MB.");
      return;
    }

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const ts = Date.now();
    const path = `rental_agreement/${agreementId}/${user.id}/${docType}-${ts}.${ext}`;

    setUploading(true);
    try {
      const { error: uploadErr } = await supabase.storage
        .from("verification-docs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      // For private buckets, use a signed URL valid for 7 years (effectively permanent for the lease term)
      const { data: signedData, error: signErr } = await supabase.storage
        .from("verification-docs")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 7);
      if (signErr) throw signErr;

      const newDoc = {
        type: docType,
        path,
        url: signedData.signedUrl,
        uploaded_at: new Date().toISOString(),
        filename: file.name,
      };

      const next = [...value, newDoc];
      onChange?.(next);
      toast.success("Document uploaded");
    } catch (err) {
      console.error("[TenantIdUploader] upload failed:", err);
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleRemove = async (idx) => {
    const doc = value[idx];
    if (!doc) return;
    if (!window.confirm("Remove this document?")) return;
    try {
      if (doc.path) {
        await supabase.storage.from("verification-docs").remove([doc.path]);
      }
    } catch (err) {
      console.warn("[TenantIdUploader] remove failed (continuing):", err);
    }
    const next = value.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Document Type
          </label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || !agreementId}
            className="w-full gap-1.5"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED}
            onChange={e => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>
      </div>

      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((doc, i) => (
            <div key={`${doc.path || doc.url}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 rounded-lg text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="font-medium truncate">{DOC_TYPES.find(t => t.value === doc.type)?.label || doc.type}</span>
                <span className="text-xs text-muted-foreground truncate">{doc.filename || ""}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
                aria-label="Remove document"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Accepted: image or PDF, max 10MB per file. Stored securely; only the landlord on this agreement and you can view.
      </p>
    </div>
  );
}
