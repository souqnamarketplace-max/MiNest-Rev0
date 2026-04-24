/**
 * Admin panel for managing commission rules.
 * Supports default rate, per listing_type, and per owner.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, X, Percent } from "lucide-react";
import { toast } from "sonner";

const RULE_TYPES = [
  { value: "default", label: "Default (all)" },
  { value: "listing_type", label: "By Listing Type" },
  { value: "owner", label: "By Owner (email)" },
];

const LISTING_TYPES = [
  { value: "private_room", label: "Private Room" },
  { value: "shared_room", label: "Shared Room" },
  { value: "entire_place", label: "Entire Place" },
];

function RuleRow({ rule, onDelete, onToggle }) {
  return (
    <div className="flex items-center gap-3 bg-card rounded-xl border border-border p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground capitalize">
          {rule.rule_type === "default" ? "Default Rate" :
           rule.rule_type === "listing_type" ? `${rule.listing_type?.replace(/_/g, " ")}` :
           `Owner: ${rule.owner_user_id}`}
        </p>
        {rule.notes && <p className="text-xs text-muted-foreground">{rule.notes}</p>}
      </div>
      <Badge className="bg-accent/10 text-accent flex items-center gap-1">
        <Percent className="w-3 h-3" /> {rule.commission_percentage}%
      </Badge>
      <Badge className={rule.is_active ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"} variant="outline">
        {rule.is_active ? "Active" : "Inactive"}
      </Badge>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onToggle(rule)}>
          {rule.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 text-accent" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete" onClick={() =>  onDelete(rule.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function CommissionRulesPanel() {
  const qc = useQueryClient();
  const [ruleType, setRuleType] = useState("default");
  const [listingType, setListingType] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [percentage, setPercentage] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rules = [] } = useQuery({
    queryKey: ["commission-rules"],
    queryFn: () => entities.CommissionRule.list("-created_at", 50),
  });

  const handleAdd = async () => {
    const pct = parseFloat(percentage);
    if (!pct && pct !== 0) { toast.error("Enter a valid percentage"); return; }
    if (ruleType === "listing_type" && !listingType) { toast.error("Select a listing type"); return; }
    if (ruleType === "owner" && !ownerEmail.trim()) { toast.error("Enter owner email"); return; }

    setSaving(true);
    await entities.CommissionRule.create({
      rule_type: ruleType,
      listing_type: ruleType === "listing_type" ? listingType : undefined,
      owner_user_id: ruleType === "owner" ? ownerEmail.trim() : undefined,
      commission_percentage: pct,
      is_active: true,
      notes,
    });
    qc.invalidateQueries({ queryKey: ["commission-rules"] });
    toast.success("Commission rule added");
    setPercentage("1"); setNotes(""); setOwnerEmail(""); setListingType("");
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await entities.CommissionRule.delete(id);
    qc.invalidateQueries({ queryKey: ["commission-rules"] });
    toast.success("Rule deleted");
  };

  const handleToggle = async (rule) => {
    await entities.CommissionRule.update(rule.id, { is_active: !rule.is_active });
    qc.invalidateQueries({ queryKey: ["commission-rules"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-1">Commission Rules</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Rules apply in priority order: Owner-specific → Listing Type → Default.
        </p>
        <div className="space-y-2">
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No rules yet. Add a default rate below.</p>
          )}
          {rules.map(r => (
            <RuleRow key={r.id} rule={r} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4 text-accent" /> Add Rule
        </h4>
        <Select value={ruleType} onValueChange={setRuleType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {ruleType === "listing_type" && (
          <Select value={listingType} onValueChange={setListingType}>
            <SelectTrigger><SelectValue placeholder="Select listing type..." /></SelectTrigger>
            <SelectContent>
              {LISTING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {ruleType === "owner" && (
          <Input placeholder="Owner email address" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        )}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input type="number" min="0" max="100" step="0.1" placeholder="1.0" value={percentage} onChange={(e) => setPercentage(e.target.value)} className="pr-8" />
          </div>
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1" />
        </div>
        <Button onClick={handleAdd} disabled={saving} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
          {saving ? "Saving..." : <><Plus className="w-4 h-4" /> Add Rule</>}
        </Button>
      </div>
    </div>
  );
}