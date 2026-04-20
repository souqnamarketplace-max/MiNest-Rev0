import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VerificationSettingsPanel() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["verification-settings"],
    queryFn: () => entities.VerificationSettings.list(),
  });

  const handleEdit = (setting) => {
    setEditingId(setting.id);
    setFormData({
      price_cad: setting.price_cad || 0,
      price_usd: setting.price_usd || 0,
      required_documents: setting.required_documents || [],
      is_active: setting.is_active !== false,
    });
  };

  const handleDocumentsChange = (e) => {
    const docs = e.target.value
      .split(",")
      .map(d => d.trim())
      .filter(Boolean);
    setFormData({ ...formData, required_documents: docs });
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await entities.VerificationSettings.update(editingId, formData);
        toast.success("Settings updated");
      }
      setEditingId(null);
      setFormData({});
      queryClient.invalidateQueries({ queryKey: ["verification-settings"] });
    } catch (err) {
      toast.error("Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {settings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No verification settings configured yet.
        </div>
      ) : (
        settings.map(setting => (
          <Card key={setting.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground capitalize">
                  {setting.verification_type} Verification
                </h3>
                <Badge className="mt-2" variant={setting.is_active ? "default" : "secondary"}>
                  {setting.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {editingId !== setting.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(setting)}
                >
                  Edit
                </Button>
              )}
            </div>

            {editingId === setting.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Price (CAD)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price_cad}
                      onChange={(e) => setFormData({ ...formData, price_cad: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Price (USD)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price_usd}
                      onChange={(e) => setFormData({ ...formData, price_usd: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Required Documents</label>
                  <Textarea
                    value={formData.required_documents.join(", ")}
                    onChange={handleDocumentsChange}
                    placeholder="e.g., id_photo, address_proof"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated list of document types</p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="font-medium">
                    ${setting.price_cad} CAD / ${setting.price_usd} USD
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Required Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {setting.required_documents?.map((doc, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {doc}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}