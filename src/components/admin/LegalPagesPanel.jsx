import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PAGES = [
  { key: "terms", label: "Terms of Service", route: "/terms" },
  { key: "privacy", label: "Privacy Policy", route: "/privacy" },
  { key: "acceptable_use", label: "Acceptable Use Policy", route: "/acceptable-use" },
];

export default function LegalPagesPanel() {
  const qc = useQueryClient();
  const [activePage, setActivePage] = useState("terms");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["admin-site-content"],
    queryFn: () => entities.SiteContent.list("-updated_at", 10),
  });

  // Load content when active page or data changes
  useEffect(() => {
    if (pages) {
      const page = pages.find(p => p.page_key === activePage);
      setContent(page?.content || "");
      setDirty(false);
    }
  }, [activePage, pages]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const page = pages?.find(p => p.page_key === activePage);
      if (page) {
        await entities.SiteContent.update(page.id, {
          content,
          updated_at: new Date().toISOString(),
        });
      } else {
        await entities.SiteContent.create({
          page_key: activePage,
          title: PAGES.find(p => p.key === activePage)?.label || activePage,
          content,
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-site-content"] });
      qc.invalidateQueries({ queryKey: ["site-content", activePage] });
      setDirty(false);
      toast.success("Page content saved!");
    } catch (err) {
      console.error("Failed to save:", err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const pageConfig = PAGES.find(p => p.key === activePage);
  const currentPage = pages?.find(p => p.page_key === activePage);
  const lastUpdated = currentPage?.updated_at
    ? new Date(currentPage.updated_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Legal Pages Editor</h3>
          <p className="text-sm text-muted-foreground">Edit Terms, Privacy, and Acceptable Use content. Changes go live immediately.</p>
        </div>
      </div>

      {/* Page selector */}
      <div className="flex gap-2 flex-wrap">
        {PAGES.map(page => (
          <Button
            key={page.key}
            variant={activePage === page.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePage(page.key)}
            className="gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            {page.label}
          </Button>
        ))}
      </div>

      {/* Editor */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 border-b border-border px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-foreground">{pageConfig?.label}</h4>
            {dirty && <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Unsaved changes</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && <span className="text-xs text-muted-foreground">Last saved: {lastUpdated}</span>}
            <a href={pageConfig?.route} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <Eye className="w-3.5 h-3.5" /> Preview
              </Button>
            </a>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">Formatting Guide:</p>
              <p>Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">## Heading</code> for section headers. Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">**bold text**</code> for emphasis. Each paragraph should be on its own line. Leave empty lines between sections.</p>
            </div>
          </div>

          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            className="min-h-[400px] font-mono text-sm leading-relaxed resize-y"
            placeholder={`Enter the ${pageConfig?.label} content here...\n\nUse ## for section headings\nUse **text** for bold\n\nLeave the field empty to use the default built-in content.`}
          />
        </div>

        <div className="border-t border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {content ? `${content.length} characters` : "Using default built-in content"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setContent(""); setDirty(true); }}
              className="text-xs"
            >
              Reset to Default
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
