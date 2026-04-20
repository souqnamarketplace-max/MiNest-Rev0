import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * BATCH 6 — BACKWARD COMPATIBILITY MIGRATION
 * 
 * Purpose: Backfill all existing listings with new rent_amount, rent_period, and rent_normalized_monthly fields.
 * This ensures:
 * - No breaking changes
 * - All old listings default to monthly
 * - New pricing UI works for both old and new listings
 * 
 * Run once: Admin can trigger this via dashboard or call it manually
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch ALL listings (paginate if needed)
    const listings = await base44.asServiceRole.entities.Listing.list('-created_date', 1000);
    
    let updated = 0;
    let skipped = 0;

    for (const listing of listings) {
      // Skip if already migrated
      if (listing.rent_amount && listing.rent_period) {
        skipped++;
        continue;
      }

      // Calculate new fields
      const monthly_rent = listing.monthly_rent || 0;
      const rent_amount = monthly_rent;
      const rent_period = 'monthly';
      const rent_normalized_monthly = rent_amount;

      // Update listing
      await base44.asServiceRole.entities.Listing.update(listing.id, {
        rent_amount,
        rent_period,
        rent_normalized_monthly,
      });

      updated++;
    }

    return Response.json({
      success: true,
      updated,
      skipped,
      total: listings.length,
      message: `Migration complete: ${updated} listings updated, ${skipped} already migrated`,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});