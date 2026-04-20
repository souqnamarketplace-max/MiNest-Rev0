/**
 * POST /api/listings/increment-views
 * Atomically increments view_count on a listing.
 * Uses Supabase RPC for atomic increment — no race conditions.
 * Falls back to manual read+write if RPC unavailable.
 * No auth required (public can view listings).
 */
import { getServiceClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { listing_id } = req.body;
    if (!listing_id) return res.status(400).json({ error: 'Missing listing_id' });

    const supabase = getServiceClient();

    // Try atomic RPC first (requires increment_listing_views function in SQL)
    const { error: rpcError } = await supabase.rpc('increment_listing_views', {
      listing_id_input: listing_id,
    });

    if (!rpcError) {
      return res.status(200).json({ success: true });
    }

    // Fallback: manual increment if RPC not set up yet
    console.warn('[increment-views] RPC unavailable, using fallback:', rpcError.message);

    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('view_count')
      .eq('id', listing_id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const newCount = (listing.view_count || 0) + 1;
    await supabase
      .from('listings')
      .update({ view_count: newCount })
      .eq('id', listing_id);

    return res.status(200).json({ success: true, view_count: newCount });
  } catch (error) {
    console.error('[increment-views] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
