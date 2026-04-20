/**
 * MobileDrawerSelect — renders as a native bottom Drawer on mobile (<768px)
 * and falls back to the standard shadcn Select on desktop.
 * Drop-in replacement: same props as Select (value, onValueChange, children, placeholder, className).
 *
 * Children should be <SelectItem value="...">label</SelectItem> elements.
 * We parse them here to build the drawer list.
 */
import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// Recursively extract SelectItem children
function extractItems(children) {
  const items = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === SelectItem || (child.props && child.props.value !== undefined && child.props.children)) {
      items.push({ value: child.props.value, label: child.props.children });
    } else if (child.props?.children) {
      items.push(...extractItems(child.props.children));
    }
  });
  return items;
}

export default function MobileDrawerSelect({
  value,
  onValueChange,
  placeholder = "Select...",
  children,
  className,
  title,
  disabled,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const items = extractItems(children);
  const selectedLabel = items.find((i) => i.value === value)?.label;

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]",
          className
        )}
      >
        <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          {title && (
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="flex flex-col pb-safe pb-6 max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.value}
                type="button"
                className="flex items-center justify-between px-6 py-4 text-sm text-foreground hover:bg-muted transition-colors min-h-[44px]"
                onClick={() => {
                  onValueChange?.(item.value);
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                {value === item.value && <Check className="w-4 h-4 text-accent" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}