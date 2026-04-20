import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * BATCH 6 — BACKWARD COMPATIBILITY MIGRATION
 * 
 * Safely migrate existing listings to new parking model.
 * 
 * Old field: parking_available (boolean)
 * New fields: parking_status, parking_type, parking_price, parking_price_period, parking_notes
 * 
 * Migration logic:
 * - If parking_available = true → parking_status = "free_included" (conservative default)
 * - If parking_available = false → parking_status = "not_available"
 * - If no parking fields exist → parking_status = "not_available" (safe default)
 * 
 * Run once: Admin can trigger via function endpoint
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all listings (paginate if needed)
    const listings = await base44.asServiceRole.entities.Listing.list('-created_date', 1000);

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const listing of listings) {
      try {
        // Check if already migrated
        if (listing.parking_status) {
          skipped++;
          continue;
        }

        // Determine new parking status from old field
        let parking_status = "not_available";
        
        if (listing.parking_available === true) {
          parking_status = "free_included";
        } else if (listing.parking_available === false) {
          parking_status = "not_available";
        }

        // Prepare update
        const updateData = {
          parking_status,
          parking_type: null,
          parking_price: null,
          parking_price_period: null,
          parking_notes: "",
        };

        // If it was free parking, try to infer type (or leave empty)
        if (parking_status === "free_included") {
          updateData.parking_type = ""; // No inference — let owner fill in via edit
        }

        // Update listing
        await base44.asServiceRole.entities.Listing.update(listing.id, updateData);
        updated++;
      } catch (err) {
        errors.push({ listingId: listing.id, error: err.message });
      }
    }

    const message = errors.length > 0
      ? `Migration complete with errors: ${updated} updated, ${skipped} skipped, ${errors.length} errors`
      : `Migration complete: ${updated} updated, ${skipped} already migrated, ${errors.length} errors`;

    return Response.json({
      success: errors.length === 0,
      updated,
      skipped,
      total: listings.length,
      errors: errors.slice(0, 10), // Return first 10 errors
      message,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});