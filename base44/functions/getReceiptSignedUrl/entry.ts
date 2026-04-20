/**
 * Generates a signed URL for downloading a payment receipt.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { transaction_id } = await req.json();
  if (!transaction_id) {
    return Response.json({ error: 'Missing transaction_id' }, { status: 400 });
  }

  // Fetch transaction to verify access
  const txs = await base44.asServiceRole.entities.PaymentTransaction.filter({ id: transaction_id });
  const tx = txs[0];
  if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

  // Only tenant and owner can access
  if (tx.tenant_user_id !== user.email && tx.owner_user_id !== user.email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // If no receipt URI, generate one on demand
  let receipt_uri = tx.receipt_uri;
  if (!receipt_uri) {
    const res = await base44.asServiceRole.functions.invoke('generatePaymentReceipt', {
      transaction_id: transaction_id,
    }).catch(err => ({ error: err.message }));

    if (res.error) {
      return Response.json({ error: 'Could not generate receipt' }, { status: 500 });
    }

    receipt_uri = res.receipt_uri;
  }

  if (!receipt_uri) {
    return Response.json({ error: 'No receipt available' }, { status: 400 });
  }

  // Create signed URL (valid for 1 hour)
  const signedUrl = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
    file_uri: receipt_uri,
    expires_in: 3600,
  }).catch(err => ({ error: err.message }));

  if (signedUrl.error) {
    return Response.json({ error: 'Could not create download link' }, { status: 500 });
  }

  return Response.json({
    signed_url: signedUrl.signed_url,
  });
});