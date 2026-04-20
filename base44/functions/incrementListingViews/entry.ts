import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { listing_id } = await req.json();

    if (!listing_id) {
      return Response.json({ error: 'Missing listing_id' }, { status: 400 });
    }

    // Fetch listing
    const listings = await base44.asServiceRole.entities.Listing.filter({ id: listing_id });
    if (!listings.length) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    const listing = listings[0];
    const currentViews = listing.view_count || 0;

    // Increment view count
    await base44.asServiceRole.entities.Listing.update(listing_id, {
      view_count: currentViews + 1
    });

    return Response.json({ success: true, view_count: currentViews + 1 });
  } catch (error) {
    console.error('View count error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});