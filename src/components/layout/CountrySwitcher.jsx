/**
 * CountrySwitcher — Flag + country dropdown in header
 * Shows current country, lets user switch between Canada/USA
 */
import { useState } from 'react';
import { ChevronDown, Check, MapPin } from 'lucide-react';
import { useCountry } from '@/lib/CountryContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const COUNTRIES = [
  { value: 'Canada', flag: '🍁', short: 'CA', currency: 'CAD', fullName: 'Canada' },
  { value: 'United States', flag: '🇺🇸', short: 'US', currency: 'USD', fullName: 'United States' },
];

export default function CountrySwitcher({ variant = 'default' }) {
  const { country, setCountry, flag, short } = useCountry();
  const [open, setOpen] = useState(false);

  const handleSwitch = async (newCountry) => {
    if (newCountry === country) return;
    await setCountry(newCountry);
    const newFlag = COUNTRIES.find(c => c.value === newCountry)?.flag;
    toast.success(`Switched to ${newCountry} ${newFlag}`, {
      description: 'Listings and prices are now tailored to your region.',
    });
    setOpen(false);
  };

  if (variant === 'mobile') {
    // Mobile variant - full width buttons in sheet
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3">Region</p>
        {COUNTRIES.map(c => (
          <button
            key={c.value}
            onClick={() => handleSwitch(c.value)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              country === c.value
                ? 'bg-accent/10 text-accent'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <span className="text-xl">{c.flag}</span>
            <div className="flex-1 text-left">
              <div className="font-semibold">{c.fullName}</div>
              <div className="text-xs opacity-70">{c.currency}</div>
            </div>
            {country === c.value && <Check className="w-4 h-4 text-accent" />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          aria-label="Select country"
        >
          <span className="text-base">{flag}</span>
          <span className="hidden sm:inline font-semibold">{short}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Your region
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COUNTRIES.map(c => (
          <DropdownMenuItem
            key={c.value}
            onClick={() => handleSwitch(c.value)}
            className="gap-3 cursor-pointer py-2.5"
          >
            <span className="text-xl">{c.flag}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{c.fullName}</div>
              <div className="text-xs text-muted-foreground">Currency: {c.currency}</div>
            </div>
            {country === c.value && <Check className="w-4 h-4 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
