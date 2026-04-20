/**
 * Breadcrumbs — Visual + SEO breadcrumb navigation component.
 */
import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
          {i === items.length - 1 ? (
            <span className="text-foreground font-medium truncate max-w-[200px]">{item.name}</span>
          ) : (
            <Link to={item.path} className="hover:text-foreground transition-colors truncate max-w-[150px]">
              {item.name}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}