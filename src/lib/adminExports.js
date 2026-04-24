import { supabase } from "@/lib/supabase";

/**
 * Convert array of objects to CSV string.
 * Handles escaping, nested objects (as JSON), and nulls.
 */
export function toCSV(rows, columns = null) {
  if (!rows || rows.length === 0) return "";
  const cols = columns || Object.keys(rows[0]);
  const headerLine = cols.join(",");
  const dataLines = rows.map((row) =>
    cols.map((col) => {
      const v = row[col];
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

/**
 * Trigger a browser download of a CSV.
 */
export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Log the export action to the audit log.
 */
async function logExport(entityType, rowCount) {
  try {
    await supabase.rpc("log_audit", {
      p_entity_type: entityType,
      p_entity_id: null,
      p_action: "export",
      p_metadata: { row_count: rowCount, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.warn("Failed to log export action:", err);
  }
}

/**
 * Export all listings to CSV.
 */
export async function exportListings() {
  const cols = [
    "id", "title", "slug", "owner_user_id", "listing_type", "status",
    "country", "province_or_state", "city",
    "rent_amount", "rent_period", "rent_normalized_monthly", "currency_code",
    "bills_included", "internet_included", "pets_allowed", "furnishing",
    "verification_badges", "is_boosted", "created_at", "updated_at",
  ];
  const { data, error } = await supabase
    .from("listings")
    .select(cols.join(","))
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = toCSV(data, cols);
  downloadCSV(csv, `minest-listings-${new Date().toISOString().split("T")[0]}.csv`);
  await logExport("listings", data?.length || 0);
  return data?.length || 0;
}

/**
 * Export all users to CSV.
 */
export async function exportUsers() {
  const cols = [
    "user_id", "email", "display_name", "country", "city",
    "is_admin",
    "created_at", "updated_at",
  ];
  const { data, error } = await supabase
    .from("user_profiles")
    .select(cols.join(","))
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = toCSV(data, cols);
  downloadCSV(csv, `minest-users-${new Date().toISOString().split("T")[0]}.csv`);
  await logExport("user_profiles", data?.length || 0);
  return data?.length || 0;
}

/**
 * Export all payment transactions to CSV.
 */
export async function exportTransactions() {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  if (!data || data.length === 0) {
    downloadCSV("id,created_at,amount,status\n(no transactions yet)", `minest-transactions-${new Date().toISOString().split("T")[0]}.csv`);
    await logExport("payment_transactions", 0);
    return 0;
  }
  const csv = toCSV(data);
  downloadCSV(csv, `minest-transactions-${new Date().toISOString().split("T")[0]}.csv`);
  await logExport("payment_transactions", data.length);
  return data.length;
}

/**
 * Export saved searches to CSV.
 */
export async function exportSavedSearches() {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = toCSV(data);
  downloadCSV(csv, `minest-saved-searches-${new Date().toISOString().split("T")[0]}.csv`);
  await logExport("saved_searches", data?.length || 0);
  return data?.length || 0;
}
