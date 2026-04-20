import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ProposeNewTimeModal({ open, onOpenChange, onPropose, loading, originalStart }) {
  const [form, setForm] = useState({
    date: "",
    time: "",
    message: "",
  });

  const handleSubmit = () => {
    if (!form.date || !form.time) {
      toast.error("Please select date and time");
      return;
    }

    const proposedStart = new Date(`${form.date}T${form.time}`);
    const now = new Date();

    if (proposedStart <= now) {
      toast.error("Proposed time must be in the future");
      return;
    }

    // Default 30 min duration
    const proposedEnd = new Date(proposedStart.getTime() + 30 * 60 * 1000);

    onPropose(proposedStart, proposedEnd, form.message);
    setForm({ date: "", time: "", message: "" });
  };

  const handleClose = () => {
    setForm({ date: "", time: "", message: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Propose a New Time</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {originalStart && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Original request:</p>
              <p className="text-sm font-medium text-foreground">
                {originalStart.toLocaleDateString()} at {originalStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}

          <div>
            <Label>New Date *</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div>
            <Label>New Time *</Label>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Message to viewer (optional)</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="e.g., That time doesn't work for me, but I'm available then instead..."
              className="mt-1 min-h-20 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              {loading ? "Sending..." : "Propose Time"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}