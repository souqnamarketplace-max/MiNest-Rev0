/**
 * RentalDocumentsViewer — displays tenant ID/passport documents to the
 * landlord (and admins). Hidden from the tenant themselves.
 *
 * - Image documents (jpg/png/etc.) shown as 2-column thumbnail grid
 * - Non-image documents shown as a file row with "Open" button
 * - Click thumbnail or "Open" -> opens signed URL in new tab
 *
 * Props:
 *   documents: Array<{ type, url, path, filename, uploaded_at }>
 *   visible: boolean (rendered only when true)
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Image as ImageIcon, ShieldCheck, ZoomIn } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS = {
  id_card: "Government ID Card",
  passport: "Passport",
  drivers_license: "Driver's License",
};

const isImage = (doc) => /\.(png|jpe?g|gif|webp)$/i.test(doc.filename || doc.path || doc.url || "");

function fmtDate(d) {
  if (!d) return "";
  try { return format(new Date(d), "PP"); } catch { return ""; }
}

function DocumentThumbnail({ doc, onOpen }) {
  const [error, setError] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full aspect-[3/2] bg-muted/50 relative group hover:opacity-90 transition-opacity"
        aria-label={`Open ${TYPE_LABELS[doc.type] || doc.type}`}
      >
        {!error ? (
          <img
            src={doc.url}
            alt={TYPE_LABELS[doc.type] || doc.type}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={() => setError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ZoomIn className="w-6 h-6 text-white" />
        </div>
      </button>
      <div className="px-3 py-2 text-xs">
        <div className="font-medium text-foreground truncate">{TYPE_LABELS[doc.type] || doc.type}</div>
        <div className="text-muted-foreground truncate">{doc.filename || "(no filename)"}</div>
        {doc.uploaded_at && (
          <div className="text-muted-foreground/70 text-[10px] mt-0.5">Uploaded {fmtDate(doc.uploaded_at)}</div>
        )}
      </div>
    </div>
  );
}

function DocumentFileRow({ doc, onOpen }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 bg-muted/20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{TYPE_LABELS[doc.type] || doc.type}</div>
          <div className="text-xs text-muted-foreground truncate">{doc.filename || "(no filename)"}</div>
          {doc.uploaded_at && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">Uploaded {fmtDate(doc.uploaded_at)}</div>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onOpen} className="flex-shrink-0 gap-1.5">
        <ExternalLink className="w-3.5 h-3.5" /> Open
      </Button>
    </div>
  );
}

export default function RentalDocumentsViewer({ documents = [], visible = true }) {
  if (!visible) return null;
  if (!documents || documents.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg px-4 py-6 text-center text-sm text-muted-foreground">
        Tenant has not uploaded any verification documents yet.
      </div>
    );
  }

  const open = (doc) => {
    if (!doc.url) return;
    window.open(doc.url, "_blank", "noopener,noreferrer");
  };

  const images = documents.filter(isImage);
  const others = documents.filter(d => !isImage(d));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-accent" />
        <span>{documents.length} document{documents.length === 1 ? "" : "s"} on file. Visible to landlord and platform administrators only.</span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map((doc, i) => (
            <DocumentThumbnail key={`img-${doc.path || doc.url || i}`} doc={doc} onOpen={() => open(doc)} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          {others.map((doc, i) => (
            <DocumentFileRow key={`file-${doc.path || doc.url || i}`} doc={doc} onOpen={() => open(doc)} />
          ))}
        </div>
      )}
    </div>
  );
}
