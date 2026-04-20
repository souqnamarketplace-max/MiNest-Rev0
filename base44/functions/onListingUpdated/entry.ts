import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Entity automation payload: { event, data, old_data }
    const new_data = body.data || body.new_data;
    const old_data = body.old_data;
    const listing_id = new_data?.id || body.listing_id;

    if (!listing_id || !new_data) {
      return Response.json({ skipped: true, reason: 'Missing listing data' });
    }

    // Get all users who favorited this listing
    const favorites = await base44.asServiceRole.entities.Favorite.filter({ listing_id });

    if (favorites.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Track price change
    const oldPrice = old_data?.rent_amount || old_data?.monthly_rent;
    const newPrice = new_data.rent_amount || new_data.monthly_rent;
    const priceChanged = oldPrice && newPrice && oldPrice !== newPrice;
    const priceReduced = priceChanged && newPrice < oldPrice;

    const notificationPromises = favorites.map(fav => {
      let title = `A saved listing has been updated`;
      let body = `"${new_data.title}" has been modified.`;

      if (priceReduced) {
        title = `Price dropped on "${new_data.title}"`;
        body = `Price dropped from ${new_data.currency_code} $${oldPrice} to ${new_data.currency_code} $${newPrice}`;
      } else if (priceChanged) {
        body = `Price changed from ${new_data.currency_code} $${oldPrice} to ${new_data.currency_code} $${newPrice}`;
      }

      return base44.asServiceRole.entities.Notification.create({
        user_id: fav.user_id,
        type: priceReduced ? 'price_drop_on_favorite' : 'favorite_listing_updated',
        role_target: 'seeker',
        title,
        body,
        link: `/listing/${listing_id}`,
        metadata: { listing_id, old_price: oldPrice, new_price: newPrice, price_reduced: priceReduced },
        delivery_status_in_app: 'delivered',
      });
    });

    await Promise.all(notificationPromises);

    return Response.json({ success: true, notified: favorites.length });
  } catch (error) {
    console.error('Error in onListingUpdated:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});