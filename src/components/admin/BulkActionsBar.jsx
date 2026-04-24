import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, Pause, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

/**
 * BulkActionsBar — sticky bar that appears when items are selected.
 * Supports approve, reject, pause, and delete.
 *
 * Props:
 *   selectedIds: Set of selected listing IDs
 *   onClear: callback to clear selection
 *   onComplete: callback after a bulk action succeeds (to refresh list)
 */
export default function BulkActionsBar({ selectedIds, onClear, onComplete }) {
  const [busy, setBusy] = React.useState(false);
  const count = selectedIds.size;

  if (count === 0) return null;

  const runBulk = async (action, updateData, label) => {
    if (!window.confirm(`${label} ${count} listing${count !== 1 ? "s" : ""}? This cannot be easily undone.`)) return;
    setBusy(true);
    try {
      const ids = Array.from(selectedIds);
      let result;
      if (action === "delete") {
        result = await supabase.from("listings").delete().in("id", ids);
      } else {
        result = await supabase.from("listings").update(updateData).in("id", ids);
      }
      if (result.error) throw result.error;

      // Log the bulk action
      await supabase.rpc("log_audit", {
        p_entity_type: "listing",
        p_entity_id: null,
        p_action: "bulk_action",
        p_metadata: {
          bulk_type: action,
          count,
          listing_ids: ids,
          update: updateData,
        },
      });

      toast.success(`${label} ${count} listing${count !== 1 ? "s" : ""}.`);
      onClear?.();
      onComplete?.();
    } catch (err) {
      toast.error(err.message || `${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky bottom-4 z-50 mx-auto max-w-3xl">
      <div className="bg-foreground text-background rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold flex-shrink-0">
          {count} selected
        </span>
        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runBulk("approve", { status: "active" }, "Approved")}
            disabled={busy}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border-0 h-8"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runBulk("reject", { status: "rejected" }, "Rejected")}
            disabled={busy}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-0 h-8"
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runBulk("pause", { status: "paused" }, "Paused")}
            disabled={busy}
            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-0 h-8"
          >
            <Pause className="w-3.5 h-3.5 mr-1" /> Pause
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runBulk("delete", null, "Deleted")}
            disabled={busy}
            className="bg-red-500/30 hover:bg-red-500/40 text-red-200 border-0 h-8"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
        </div>
        <Button size="icon" variant="ghost" onClick={onClear} className="h-8 w-8 flex-shrink-0 hover:bg-background/10 text-background">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * SelectableRow — wraps a list row with a checkbox.
 */
export function SelectableRow({ id, selectedIds, setSelectedIds, children }) {
  const checked = selectedIds.has(id);
  const toggle = () => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  return (
    <div className="flex items-start gap-3">
      <div className="pt-3">
        <Checkbox checked={checked} onCheckedChange={toggle} aria-label={`Select ${id}`} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
