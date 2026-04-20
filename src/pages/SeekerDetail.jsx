import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, DollarSign, Briefcase, Calendar, MessageSquare, ArrowLeft,
  Cigarette, PawPrint, Users, GraduationCap, Heart, Flag
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function SeekerDetail() {
  const seekerId = window.location.pathname.split("/seeker/")[1];
  const { user, navigateToLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const { data: seeker, isLoading } = useQuery({
    queryKey: ["seeker", seekerId],
    queryFn: async () => {
      // Support both UUID and slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seekerId);
      const seekers = isUuid
        ? await entities.SeekerProfile.filter({ id: seekerId })
        : await entities.SeekerProfile.filter({ slug: seekerId });
      return seekers[0] || null;
    },
    enabled: !!seekerId,
  });

  const { data: seekerProfile } = useQuery({
    queryKey: ["seekerProfile", seeker?.owner_user_id],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: seeker.owner_user_id });
      return profiles[0] || null;
    },
    enabled: !!seeker?.owner_user_id,
  });

  const handleContact = async () => {
    if (!user) {
      navigateToLogin(window.location.href);
      return;
    }
    try {
      const seekerName = seekerProfile?.display_name || seekerProfile?.full_name || seeker.headline || "Seeker";
      const { data: existingConvos } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [user.id, seeker.owner_user_id])
        .eq('roommate_profile_id', seeker.id)
        .limit(1);

      let conv = existingConvos?.[0];
      if (!conv) {
        conv = await entities.Conversation.create({
          participant_ids: [user.id, seeker.owner_user_id],
          participant_names: [user.full_name || user.email, seekerName],
          roommate_profile_id: seeker.id,
          status: "active"
        });
      }
      navigate(`/messages?id=${conv.id}`);
    } catch (err) {
      toast.error("Failed to open chat");
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      toast.error("Please select a reason");
      return;
    }
    if (!user) {
      navigateToLogin(window.location.href);
      return;
    }
    setReportSubmitting(true);
    try {
      await entities.Report.create({
        reporter_user_id: user.id,
        target_type: "user",
        target_id: seeker.owner_user_id,
        reason: reportReason,
        details: reportDetails,
        status: "pending"
      });
      toast.success("Report submitted. Thank you for helping us keep the community safe.");
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      toast.error("Failed to submit report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!seeker) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Seeker not found</h2>
        <Link to="/roommates"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Roommates</Button></Link>
      </div>
    );
  }

  const isOwner = user?.id === seeker?.owner_user_id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/roommates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to roommates
      </Link>

      <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src={seeker.avatar_url} loading="lazy" decoding="async" />
            <AvatarFallback className="bg-accent/10 text-accent text-lg font-bold">
              {seeker.headline?.[0]?.toUpperCase() || "S"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground mb-2">{seeker.headline || "Roommate Seeker"}</h1>
            {seeker.preferred_cities?.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>
                  {seeker.preferred_cities.join(", ")}
                  {seeker.preferred_province_or_state ? `, ${seeker.preferred_province_or_state}` : ""}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              {seeker.age && (
                <span className="text-sm text-muted-foreground">🎂 Age {seeker.age}</span>
              )}
              {seeker.gender && (
                <span className="text-sm text-muted-foreground capitalize">👤 {seeker.gender}</span>
              )}
              {seeker.occupation && (
                <span className="text-sm text-muted-foreground">💼 {seeker.occupation}</span>
              )}
            </div>
            {seeker.verification_badges?.length > 0 && (
              <Badge variant="outline" className="text-accent">Verified</Badge>
            )}
          </div>
          {!isOwner && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setReportOpen(true)}
              className="flex-shrink-0"
            >
              <Flag className="w-5 h-5 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* About */}
        {seeker.bio && (
          <div>
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{seeker.bio}</p>
          </div>
        )}

        {/* Budget & Timeline */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              Budget
            </div>
            {seeker.min_budget && seeker.max_budget ? (
              <div className="text-lg font-bold text-accent">
                {seeker.min_budget} - {seeker.max_budget} {seeker.currency_code}/mo
              </div>
            ) : (
              <div className="text-muted-foreground">Not specified</div>
            )}
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              Move-in Date
            </div>
            <div className="text-lg font-bold">
              {seeker.move_in_date
                ? new Date(seeker.move_in_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
                : "Flexible"}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Briefcase, label: "Work Status", value: seeker.work_status },
            { icon: Calendar, label: "Stay", value: seeker.min_stay_months && seeker.max_stay_months
                ? `${seeker.min_stay_months}–${seeker.max_stay_months} months`
                : seeker.min_stay_months ? `Min ${seeker.min_stay_months} months` : null },
            { icon: Cigarette, label: "Smoking", value: seeker.smoker === true ? "Yes" : seeker.smoker === false ? "No" : null },
            { icon: PawPrint, label: "Has Pets", value: seeker.has_pets === true ? "Yes" : seeker.has_pets === false ? "No" : null },
            { icon: Heart, label: "Sleep Schedule", value: seeker.sleep_schedule },
            { icon: GraduationCap, label: "Student", value: seeker.student_status ? "Yes" : null },
          ].map((item, i) => {
            if (!item.value) return null;
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-accent flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-semibold capitalize">{String(item.value).replace(/_/g, " ")}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lifestyle Tags */}
        {seeker.lifestyle_tags?.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Lifestyle</h2>
            <div className="flex flex-wrap gap-2">
              {seeker.lifestyle_tags.map(tag => (
                <Badge key={tag} variant="secondary" className="capitalize">
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Preferred Room Types */}
        {seeker.room_type_preference?.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Looking For</h2>
            <div className="flex flex-wrap gap-2">
              {seeker.room_type_preference.map(type => (
                <Badge key={type} variant="outline" className="capitalize">
                  {type.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Preferences */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Preferences</h2>
          <div className="space-y-2">
            {[
              { label: "Gender Preference", value: seeker.preferred_gender_of_roommate },
              { label: "Cleanliness Level", value: seeker.cleanliness_level },
              { label: "Noise Tolerance", value: seeker.noise_tolerance },
              { label: "Social Level", value: seeker.social_level },
            ].map((pref, i) => {
              if (!pref.value) return null;
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{pref.label}</span>
                  <span className="font-medium capitalize">{pref.value.replace(/_/g, " ")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        {!isOwner && (
          <Button
            onClick={handleContact}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-11"
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Contact Seeker
          </Button>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report This User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="report-reason" className="text-sm font-semibold block mb-2">Reason</label>
              <select
id="report-reason" value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="scam">Scam</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="harassment">Harassment</option>
                <option value="fake_profile">Fake Profile</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-details" className="text-sm font-semibold block mb-2">Details</label>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                id="report-details" placeholder="Provide details about why you're reporting this user..."
                className="min-h-24"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReportSubmit}
                disabled={reportSubmitting || !reportReason}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}