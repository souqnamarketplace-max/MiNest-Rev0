import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { invokeLLM } from '@/api/entities';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';

export default function RoommateAgreementGenerator() {
  const [formData, setFormData] = useState({
    roommate1_name: "",
    roommate1_email: "",
    roommate2_name: "",
    roommate2_email: "",
    property_address: "",
    move_in_date: "",
    lease_term_months: "12",
    rent_amount: "",
    utilities_breakdown: "",
    house_rules: "",
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    guests_policy: ""
  });
  const [generatingRules, setGeneratingRules] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Pre-fill from URL params (e.g. from a listing)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = {};
    if (params.get("address")) prefill.property_address = params.get("address");
    if (params.get("rent")) prefill.rent_amount = params.get("rent");
    if (params.get("move_in")) prefill.move_in_date = params.get("move_in");
    if (params.get("name1")) prefill.roommate1_name = params.get("name1");
    if (params.get("email1")) prefill.roommate1_email = params.get("email1");
    if (Object.keys(prefill).length > 0) {
      setFormData(prev => ({ ...prev, ...prefill }));
    }
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateRules = async () => {
    setGeneratingRules(true);
    const res = await invokeLLM({
      prompt: `Generate professional house rules for a shared rental property at: ${formData.property_address || "a shared home"}.
Context: monthly rent is $${formData.rent_amount || "unknown"}, move-in date ${formData.move_in_date || "flexible"}.
Write 7-9 clear, fair, practical house rules as bullet points starting with •. Be concise and professional.`,
    });
    setFormData(prev => ({ ...prev, house_rules: res }));
    setGeneratingRules(false);
    toast.success("House rules generated!");
  };

  const generatePDF = () => {
    setAttempted(true);
    const agreementErrors = [];
    if (!formData.roommate1_name?.trim()) agreementErrors.push('Roommate 1 name is required');
    if (!formData.roommate2_name?.trim()) agreementErrors.push('Roommate 2 name is required');
    if (!formData.property_address?.trim()) agreementErrors.push('Property address is required');
    if (agreementErrors.length > 0) { agreementErrors.forEach(e => toast.error(e));
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    const lineHeight = 7;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    const addText = (text, size = 11, isBold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, contentWidth);
      lines.forEach(line => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 3;
    };

    addText("ROOMMATE AGREEMENT", 16, true);
    yPosition += 5;

    addText(`This Roommate Agreement ("Agreement") is made and entered into as of ${new Date().toLocaleDateString()},`, 11);
    addText("between:", 11);
    yPosition += 5;

    addText(formData.roommate1_name, 11, true);
    addText(`Email: ${formData.roommate1_email}`, 10);
    addText('("Roommate 1")', 10);
    yPosition += 5;

    addText("AND", 11, true);
    yPosition += 5;

    addText(formData.roommate2_name, 11, true);
    addText(`Email: ${formData.roommate2_email}`, 10);
    addText('("Roommate 2")', 10);
    yPosition += 5;

    addText("WHEREAS, the Roommates wish to establish clear expectations and responsibilities for sharing a residential property;", 11);
    yPosition += 5;

    addText("NOW THEREFORE in consideration of the mutual covenants and agreements herein, the Roommates agree as follows:", 11);
    yPosition += 5;

    addText("1. PROPERTY INFORMATION", 12, true);
    addText(`The shared residential property is located at: ${formData.property_address}`, 11);
    addText(`Move-in Date: ${formData.move_in_date}`, 11);
    addText(`Lease Term: ${formData.lease_term_months} months`, 11);

    addText("2. RENT AND UTILITIES", 12, true);
    addText(`Monthly Rent per Roommate: $${formData.rent_amount}`, 11);
    addText(`Utilities Breakdown: ${formData.utilities_breakdown || "To be divided equally"}`, 11);

    addText("3. QUIET HOURS", 12, true);
    addText(`Quiet hours are from ${formData.quiet_hours_start} to ${formData.quiet_hours_end} daily. During these hours, Roommates agree to keep noise levels to a minimum.`, 11);

    addText("4. HOUSE RULES", 12, true);
    const houseRulesText = formData.house_rules || "• Keep common areas clean\n• Wash dishes immediately after use\n• Respect each other's privacy and belongings\n• No smoking indoors\n• Guests must be respectful of roommates' schedules";
    addText(houseRulesText, 11);

    addText("5. GUEST POLICY", 12, true);
    addText(formData.guests_policy || "Guests are welcome but must be courteous of roommates' schedules. Overnight guests should be discussed in advance.", 11);

    addText("6. SHARED RESPONSIBILITIES", 12, true);
    addText("• Cleaning Schedule: To be determined by mutual agreement\n• Grocery Shopping: Individual responsibility\n• Trash and Recycling: To be taken out weekly\n• Common Areas: Shared responsibility", 11);

    addText("7. DISPUTE RESOLUTION", 12, true);
    addText("If a dispute arises, the Roommates agree to address it calmly and respectfully. If unresolved, mediation may be sought through a neutral third party.", 11);

    addText("8. AGREEMENT MODIFICATIONS", 12, true);
    addText("This Agreement may be modified or amended only with written consent from both Roommates.", 11);

    yPosition += 10;
    addText("SIGNATURES:", 12, true);
    yPosition += 10;
    addText("Roommate 1: _________________________ Date: _________", 11);
    yPosition += 10;
    addText("Roommate 2: _________________________ Date: _________", 11);

    doc.save(`Roommate_Agreement_${Date.now()}.pdf`);
    toast.success("Agreement downloaded as PDF!");
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-8 h-8 text-accent" /> MiNest Roommate Agreement Generator
          </h1>
          <p className="text-muted-foreground mt-2">Create a customizable roommate agreement to establish clear expectations and responsibilities.</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 space-y-8">
          {/* Section 1: Roommate Info */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Roommate Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Roommate 1 Name *</label>
                <Input
                  id="r1-name" name="roommate1_name" value={formData.roommate1_name}
                  onChange={(e) => handleChange("roommate1_name", e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Email</label>
                <Input
                  id="r1-email" name="roommate1_email" autoComplete="email" value={formData.roommate1_email}
                  onChange={(e) => handleChange("roommate1_email", e.target.value)}
                  type="email"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Roommate 2 Name *</label>
                <Input
                  id="r2-name" name="roommate2_name" value={formData.roommate2_name}
                  onChange={(e) => handleChange("roommate2_name", e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Email</label>
                <Input
                  id="r2-email" name="roommate2_email" autoComplete="email" value={formData.roommate2_email}
                  onChange={(e) => handleChange("roommate2_email", e.target.value)}
                  type="email"
                  placeholder="Email address"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Property */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Property & Lease</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Property Address *</label>
                <Input
                  id="property-address" name="property_address" value={formData.property_address}
                  onChange={(e) => handleChange("property_address", e.target.value)}
                                  />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">Move-in Date</label>
                  <Input
                    type="date"
                    value={formData.move_in_date}
                    onChange={(e) => handleChange("move_in_date", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">Lease Term (months)</label>
                  <Input
                    type="number"
                    value={formData.lease_term_months}
                    onChange={(e) => handleChange("lease_term_months", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Finance */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Financial Terms</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Monthly Rent per Roommate</label>
                <Input
                  type="number"
                  id="rent-amount" name="rent_amount" value={formData.rent_amount}
                  onChange={(e) => handleChange("rent_amount", e.target.value)}
                  placeholder="$0"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Utilities Breakdown</label>
                <Input
                  value={formData.utilities_breakdown}
                  onChange={(e) => handleChange("utilities_breakdown", e.target.value)}
                  placeholder="e.g., Internet: $60 split equally, Hydro: $120 split equally"
                />
              </div>
            </div>
          </div>

          {/* Section 4: House Rules */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">House Rules & Policies</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Quiet Hours</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Start</span>
                    <Input
                      type="time"
                      value={formData.quiet_hours_start}
                      onChange={(e) => handleChange("quiet_hours_start", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">End</span>
                    <Input
                      type="time"
                      value={formData.quiet_hours_end}
                      onChange={(e) => handleChange("quiet_hours_end", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-foreground">Additional House Rules</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-accent h-7 px-2 gap-1"
                    onClick={handleGenerateRules}
                    disabled={generatingRules}
                  >
                    {generatingRules ? <Loader2 className="w-3 h-3 animate-spin" /> : "✨"}
                    {generatingRules ? "Generating..." : "AI Generate Rules"}
                  </Button>
                </div>
                <Textarea
                  value={formData.house_rules}
                  onChange={(e) => handleChange("house_rules", e.target.value)}
                  placeholder="E.g., • Keep common areas clean&#10;• Wash dishes immediately&#10;• No smoking indoors"
                  className="min-h-24"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">Guest Policy</label>
                <Textarea
                  value={formData.guests_policy}
                  onChange={(e) => handleChange("guests_policy", e.target.value)}
                  placeholder="Describe your guest policy and expectations"
                  className="min-h-20"
                />
              </div>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <Button onClick={generatePDF} className="gap-2 flex-1 bg-accent hover:bg-accent/90 text-white font-semibold">
              <Download className="w-4 h-4" /> Download Agreement
            </Button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-900">
          <h3 className="font-semibold mb-2">Tips for a Strong Agreement</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Discuss expectations before moving in</li>
            <li>Be specific about financial arrangements</li>
            <li>Establish clear quiet hours and guest policies</li>
            <li>Agree on chore assignments and cleaning schedules</li>
            <li>Keep a copy for your records</li>
          </ul>
        </div>
      </div>
    </div>
  );
}