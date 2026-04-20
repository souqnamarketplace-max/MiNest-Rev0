import React from "react";
import { useCountry } from "@/lib/CountryContext";
import { getCurrencyByCountry, formatAmount } from "@/lib/pricingHelpers";

export default function RentDetailsTable({ listing }) {
  const { country, convertPrice } = useCountry();
  const currency = getCurrencyByCountry(country);

  const rent_period = listing.rent_period || "monthly";
  const rent_amount = listing.rent_amount || listing.monthly_rent;

  const periodLabel = rent_period === "weekly" ? "Weekly Rent" : rent_period === "daily" ? "Daily Rent" : "Monthly Rent";
  const stayUnit = rent_period === "weekly" ? "weeks" : rent_period === "daily" ? "days" : "months";

  const rows = [
    { label: periodLabel, value: formatAmount(rent_amount, currency, convertPrice) },
    listing.deposit_amount && { label: "Security Deposit", value: formatAmount(listing.deposit_amount, currency, convertPrice) },
    { label: "Bills", value: listing.bills_included ? "Included" : "Not Included" },
    listing.minimum_stay_months && { label: "Minimum Stay", value: `${listing.minimum_stay_months} ${stayUnit}` },
    listing.maximum_stay_months && { label: "Maximum Stay", value: `${listing.maximum_stay_months} ${stayUnit}` },
  ].filter(Boolean);

  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Rent & Terms</h3>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-semibold text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
