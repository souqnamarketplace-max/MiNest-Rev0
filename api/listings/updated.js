/**
 * POST /api/listings/updated
 * Called when a listing is updated.
 * Notifies users who favorited the listing of price changes.
 * Optimized: only queries favorites if price actually changed.
 */
import { getServiceClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Support both Supabase webhook { record, old_record }
    // AND direct call { listing_id, old_data, new_data }
    const body = req.body;
    const new_data = body.record || body.new_data;
    const old_data = body.old_record || body.old_data;
    const listing_id = new_data?.id || body.listing_id;

    if (!listing_id || !new_data) {
      return res.status(200).json({ skipped: true, reason: 'Missing data' });
    }

    const supabase = getServiceClient();

    // Only notify if price changed
    const oldPrice = old_data?.rent_amount || old_data?.monthly_rent;
    const newPrice = new_data?.rent_amount || new_data?.monthly_rent;
    const priceChanged = oldPrice && newPrice && oldPrice !== newPrice;
    const priceReduced = priceChanged && newPrice < oldPrice;

    if (!priceChanged) {
      return res.status(200).json({ success: true, notified: 0, reason: 'No price change' });
    }

    // Get all users who favorited this listing — paginated for scale
    const { data: favorites } = await supabase
      .from('favorites')
      .select('user_id')
      .eq('listing_id', listing_id);

    if (!favorites?.length) {
      return res.status(200).json({ success: true, notified: 0 });
    }

    const title = priceReduced
      ? `Price dropped on "${new_data.title}"`
      : `Price changed on "${new_data.title}"`;

    const notifBody = priceReduced
      ? `Price dropped from ${new_data.currency_code} $${oldPrice} to $${newPrice}`
      : `Price changed from ${new_data.currency_code} $${oldPrice} to $${newPrice}`;

    // Batch insert notifications for performance
    const notifications = favorites.map(fav => ({
      user_id: fav.user_id,
      type: priceReduced ? 'price_drop_on_favorite' : 'favorite_listing_updated',
      title,
      body: notifBody,
      read: false,
      data: { listing_id, old_price: oldPrice, new_price: newPrice, price_reduced: priceReduced },
    }));

    // Insert in batches of 50 to avoid hitting limits
    for (let i = 0; i < notifications.length; i += 50) {
      await supabase.from('notifications').insert(notifications.slice(i, i + 50));
    }

    return res.status(200).json({ success: true, notified: favorites.length });
  } catch (error) {
    console.error('[listings/updated] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
