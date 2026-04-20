import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, Settings, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminVerification() {
  const { user, navigateToLogin, logout } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVerif, setSelectedVerif] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [settings, setSettings] = useState({});
  const [editingSettings, setEditingSettings] = useState(null);

  // Check if admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      window.location.href = "/";
    }
  }, [user]);

  // Fetch pending verifications
  const { data: verifications = [], isLoading, refetch } = useQuery({
    queryKey: ["pending-verifications"],
    queryFn: async () => {
      const pending = await entities.UserVerification.filter(
        { status: "pending" },
        "-submitted_at",
        100
      );
      return pending;
    },
  });

  // Fetch verification settings
  const { data: allSettings = [] } = useQuery({
    queryKey: ["verification-settings"],
    queryFn: async () => {
      return entities.VerificationSettings.list();
    },
  });

  useEffect(() => {
    const settingsMap = {};
    allSettings.forEach((s) => {
      settingsMap[s.verification_type] = s;
    });
    setSettings(settingsMap);
  }, [allSettings]);

  const handleApproveVerification = async () => {
    if (!selectedVerif) return;

    try {
      // Update user profile with verification badge
      const userProfiles = await entities.UserProfile.filter({
        user_id: selectedVerif.user_id,
      });

      if (userProfiles.length > 0) {
        const badges = userProfiles[0].verification_badges || [];
        if (!badges.includes(selectedVerif.verification_type)) {
          badges.push(selectedVerif.verification_type);
        }
        await entities.UserProfile.update(userProfiles[0].id, {
          verification_badges: badges,
        });
      }

      // Update verification record
      await entities.UserVerification.update(selectedVerif.id, {
        status: "approved",
        approved_at: new Date().toISOString(),
        admin_notes: reviewNotes,
      });

      // Create notification
      await entities.Notification.create({
        user_id: selectedVerif.user_id,
        type: "verification_completed",
        title: "Verification Approved",
        body: `Your ${selectedVerif.verification_type} verification has been approved!`,
        role_target: "shared",
      });

      toast.success("Verification approved");
      setReviewDialog(false);
      setReviewNotes("");
      setSelectedVerif(null);
      refetch();
    } catch (err) {
      console.error("Error approving verification:", err);
      toast.error("Failed to approve verification");
    }
  };

  const handleRejectVerification = async () => {
    if (!selectedVerif) return;

    try {
      await entities.UserVerification.update(selectedVerif.id, {
        status: "rejected",
        rejection_reason: reviewNotes,
        admin_notes: reviewNotes,
      });

      // Create notification
      await entities.Notification.create({
        user_id: selectedVerif.user_id,
        type: "verification_failed",
        title: "Verification Not Approved",
        body: `Your ${selectedVerif.verification_type} verification was not approved. ${reviewNotes}`,
        role_target: "shared",
      });

      toast.success("Verification rejected");
      setReviewDialog(false);
      setReviewNotes("");
      setSelectedVerif(null);
      refetch();
    } catch (err) {
      console.error("Error rejecting verification:", err);
      toast.error("Failed to reject verification");
    }
  };

  const handleSaveSettings = async () => {
    try {
      if (editingSettings && editingSettings.id) {
        await entities.VerificationSettings.update(editingSettings.id, {
          price_cad: editingSettings.price_cad,
          price_usd: editingSettings.price_usd,
          required_documents: editingSettings.required_documents,
        });
      }
      toast.success("Settings saved");
      setEditingSettings(null);
      queryClient.invalidateQueries({ queryKey: ["verification-settings"] });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Failed to save settings");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Verification Management</h1>
          <p className="text-muted-foreground mt-2">
            Review user verification submissions and manage verification settings
          </p>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="pending">Pending Reviews</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading verifications...</p>
              </div>
            ) : verifications.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-lg">
                <CheckCircle className="w-12 h-12 text-accent/30 mx-auto mb-3" />
                <p className="text-foreground font-medium">All caught up!</p>
                <p className="text-muted-foreground text-sm">
                  No pending verifications to review
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {verifications.map((verif) => (
                  <div
                    key={verif.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-foreground">
                            {verif.user_id}
                          </p>
                          <Badge className="capitalize">
                            {verif.verification_type}
                          </Badge>
                          <Badge
                            variant={
                              verif.status === "submitted"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {verif.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Submitted:{" "}
                          {new Date(verif.submitted_at).toLocaleDateString()}
                        </p>
                        <div className="mt-2 flex gap-2">
                          {verif.documents?.map((doc, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {doc.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedVerif(verif)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {Object.entries(settings).map(([type, setting]) => (
              <div
                key={type}
                className="bg-card border border-border rounded-lg p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground capitalize">
                    {type} Verification
                  </h3>
                  {!editingSettings?.verification_type === type && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSettings(setting)}
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {editingSettings?.verification_type === type ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Price (CAD)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingSettings.price_cad || ""}
                        onChange={(e) =>
                          setEditingSettings({
                            ...editingSettings,
                            price_cad: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Price (USD)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingSettings.price_usd || ""}
                        onChange={(e) =>
                          setEditingSettings({
                            ...editingSettings,
                            price_usd: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Required Documents (comma-separated)
                      </label>
                      <Textarea
                        value={(editingSettings.required_documents || []).join(", ")}
                        onChange={(e) =>
                          setEditingSettings({
                            ...editingSettings,
                            required_documents: e.target.value
                              .split(",")
                              .map((d) => d.trim()),
                          })
                        }
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setEditingSettings(null)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSaveSettings}>Save Settings</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-medium text-foreground">
                        ${setting.price_cad} CAD / ${setting.price_usd} USD
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Required Documents
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {setting.required_documents?.map((doc, idx) => (
                          <Badge key={idx} variant="outline">
                            {doc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Verification</DialogTitle>
          </DialogHeader>

          {selectedVerif && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">User</p>
                <p className="font-semibold text-foreground">
                  {selectedVerif.user_id}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Submitted Documents
                </p>
                <div className="space-y-2">
                  {selectedVerif.documents?.map((doc, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground capitalize">
                          {doc.type.replace(/_/g, " ")}
                        </p>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          View Document
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  placeholder="Add notes about this verification..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRejectVerification}
                >
                  Reject
                </Button>
                <Button
                  className="flex-1 bg-accent"
                  onClick={handleApproveVerification}
                >
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}