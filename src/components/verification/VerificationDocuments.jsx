import React, { useState } from "react";
import { uploadFile } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VerificationDocuments({
  verificationType,
  settings,
  onSubmit,
  loading,
}) {
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState(null);

  const requiredDocs = settings?.required_documents || [];

  const handleFileSelect = async (docType, file) => {
    if (!file) return;

    try {
      setUploading((prev) => ({ ...prev, [docType]: true }));
      setError(null);

      // Upload file
      const uploadedFile = await uploadFile(file, 'verification-docs');

      setDocuments((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          file_url: uploadedFile.file_url,
          uploaded_at: new Date().toISOString(),
        },
      }));

      toast.success("Document uploaded");
    } catch (err) {
      console.error("Upload error:", err);
      setError(`Failed to upload ${docType}`);
      toast.error("Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const handleRemoveDocument = (docType) => {
    setDocuments((prev) => {
      const updated = { ...prev };
      delete updated[docType];
      return updated;
    });
  };

  const handleSubmit = async () => {
    const allUploaded = requiredDocs.every((doc) => documents[doc]);
    if (!allUploaded) {
      setError("Please upload all required documents");
      return;
    }

    await onSubmit(Object.values(documents));
  };

  const allUploaded = requiredDocs.every((doc) => documents[doc]);

  return (
    <div className="bg-card border border-border rounded-2xl p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-2">Upload Documents</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Please upload clear, legible copies of your required documents
      </p>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {requiredDocs.map((docType) => {
          const doc = documents[docType];
          const isUploading = uploading[docType];

          return (
            <div key={docType} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {docType.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Required for verification
                  </p>
                </div>
                {doc && !isUploading && (
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                )}
              </div>

              {doc && !isUploading ? (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-foreground truncate">
                    ✓ Document uploaded
                  </p>
                  <button
                    onClick={() => handleRemoveDocument(docType)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={isUploading}
                    onChange={(e) => handleFileSelect(docType, e.target.files?.[0])}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 text-accent animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          Uploading...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">
                          Click to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, PDF up to 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading || !allUploaded}
        size="lg"
        className="w-full gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit for Review"
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Our team reviews submissions within 24-48 hours
      </p>
    </div>
  );
}