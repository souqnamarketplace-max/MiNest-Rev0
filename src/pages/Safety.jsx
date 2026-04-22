import React from "react";
import { ShieldCheck, Eye, Lock, AlertTriangle, MessageSquare, FileText } from "lucide-react";

const tips = [
  { icon: ShieldCheck, title: "Verify Profiles", desc: "Always check for verification badges. Verified users have confirmed their identity through our system." },
  { icon: Eye, title: "Meet in Public First", desc: "Meet potential roommates in a public place before committing. Never share keys or access before meeting." },
  { icon: Lock, title: "Protect Personal Info", desc: "Don't share your phone number, address, or financial information until you've built trust through our messaging system." },
  { icon: AlertTriangle, title: "Trust Your Instincts", desc: "If something feels off about a listing or person, report it. It's better to be cautious." },
  { icon: MessageSquare, title: "Use In-App Messaging", desc: "Keep all communication within MiNest so we can help if disputes arise." },
  { icon: FileText, title: "Set Clear Expectations", desc: "Discuss responsibilities, rent splitting, and house rules with your roommate before moving in." },
];

export default function Safety() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Safety First</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Your safety is our priority. Follow these tips to protect yourself while using MiNest.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {tips.map((tip, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border p-6">
            <tip.icon className="w-8 h-8 text-accent mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{tip.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}