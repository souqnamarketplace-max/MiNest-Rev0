import React, { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X } from "lucide-react";
import SearchFilters from "./SearchFilters";

/**
 * SearchLayout: Responsive 2-column desktop + mobile drawer layout
 * 
 * Desktop:
 * - Fixed left sidebar (filters) + scrollable right content (results)
 * - Filters stay sticky while results scroll
 * 
 * Mobile:
 * - Full-width results with filter drawer
 * - Filters hidden behind button/sheet
 */
export default function SearchLayout({
  filters,
  onFiltersChange,
  children, // Results content
  activeFilterCount = 0,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
        {/* Mobile filter button - only visible on small screens */}
        <div className="lg:hidden mb-5 sm:mb-6">
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full h-11 gap-2 text-base font-medium">
                <SlidersHorizontal className="w-5 h-5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-auto bg-accent text-accent-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:w-96 overflow-y-auto p-0">
              <SheetHeader className="px-6 pt-6 mb-6 border-b border-border pb-6">
                <SheetTitle className="text-xl">Search Filters</SheetTitle>
              </SheetHeader>
              <div className="px-6 pb-20">
                <SearchFilters
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                  />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* 2-column desktop layout + mobile full-width */}
        <div className="flex gap-6 lg:gap-8 w-full min-h-screen">
          {/* Desktop filter sidebar - hidden on mobile */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-24 bg-card rounded-2xl border border-border p-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <h3 className="font-semibold text-foreground mb-6 text-base">Filters</h3>
              <SearchFilters filters={filters} onFiltersChange={onFiltersChange} />
            </div>
          </div>

          {/* Results content - takes full width on mobile, flex-1 on desktop */}
          <div className="flex-1 min-w-0 w-full lg:w-auto pb-8 sm:pb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}