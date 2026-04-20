/**
 * Generates a payment receipt PDF and sends it to the tenant via email.
 * Called after successful payment.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { transaction_id } = await req.json();
  if (!transaction_id) {
    return Response.json({ error: 'Missing transaction_id' }, { status: 400 });
  }

  // Fetch transaction
  const txs = await base44.asServiceRole.entities.PaymentTransaction.filter({ id: transaction_id });
  const tx = txs[0];
  if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

  // Only tenant and owner can access
  if (tx.tenant_user_id !== user.email && tx.owner_user_id !== user.email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Generate PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  const addText = (text, size = 11, bold = false, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ''), contentWidth);
    lines.forEach(line => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += size * 0.3;
    });
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  };

  // Header
  addText('PAYMENT RECEIPT', 16, true, [0, 0, 0]);
  y += 3;

  // Transaction details
  addText(`Receipt #: ${tx.id}`, 10);
  addText(`Date: ${new Date(tx.created_date || Date.now()).toLocaleDateString()}`, 10);
  y += 3;

  addLine();

  // Property info
  addText('PROPERTY', 11, true);
  addText(tx.listing_title || 'Rental Property', 10);
  addText(tx.listing_id, 9);
  y += 3;

  // Tenant info
  addText('TENANT', 11, true);
  addText(tx.tenant_user_id, 10);
  y += 3;

  // Owner info
  addText('OWNER', 11, true);
  addText(tx.owner_user_id, 10);
  y += 3;

  addLine();

  // Rent period
  const periodStart = tx.period_start ? new Date(tx.period_start).toLocaleDateString() : 'N/A';
  const periodEnd = tx.period_end ? new Date(tx.period_end).toLocaleDateString() : 'N/A';
  addText('RENT PERIOD', 11, true);
  addText(`${periodStart} to ${periodEnd}`, 10);
  y += 3;

  // Amount breakdown
  addText('PAYMENT DETAILS', 11, true);
  const amountDollars = (tx.amount / 100).toFixed(2);
  const feeDollars = (tx.platform_fee / 100).toFixed(2);
  const ownerDollars = (tx.amount_to_owner / 100).toFixed(2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Rent Amount:`, margin, y);
  doc.text(`${tx.currency.toUpperCase()} $${amountDollars}`, pageWidth - margin - 40, y, { align: 'right' });
  y += 5;

  doc.text(`Platform Fee:`, margin, y);
  doc.text(`-${tx.currency.toUpperCase()} $${feeDollars}`, pageWidth - margin - 40, y, { align: 'right' });
  y += 5;

  doc.text(`Owner Receives:`, margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${tx.currency.toUpperCase()} $${ownerDollars}`, pageWidth - margin - 40, y, { align: 'right' });
  y += 8;

  // Status
  addLine();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const statusColor = tx.status === 'succeeded' ? [34, 197, 94] : [239, 68, 68];
  addText(`Status: ${tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}`, 11, true, statusColor);

  if (tx.status === 'succeeded') {
    addText(`✓ Payment confirmed`, 10);
  } else if (tx.status === 'failed') {
    addText(`✗ Payment failed`, 10);
    if (tx.failure_reason) addText(`Reason: ${tx.failure_reason}`, 9);
  }

  y += 3;
  addLine();

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`This is an automated receipt generated on ${new Date().toLocaleDateString()}.`, margin, pageHeight - 10);
  doc.text(`For inquiries, contact your landlord or visit the MiNest support page.`, margin, pageHeight - 6);

  // Convert PDF to bytes
  const pdfBytes = doc.output('arraybuffer');

  // Upload receipt as private file
  const fileName = `receipt_${tx.id}_${Date.now()}.pdf`;
  const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
    file: new Blob([pdfBytes], { type: 'application/pdf' }),
  }).catch(err => ({ error: err.message }));

  let receipt_uri = null;
  if (uploadRes && uploadRes.file_uri) {
    receipt_uri = uploadRes.file_uri;
  }

  // Send email to tenant
  const emailBody = `Hi,

Your rent payment for "${tx.listing_title}" has been successfully processed.

Payment Details:
- Amount: ${tx.currency.toUpperCase()} $${amountDollars}
- Period: ${periodStart} to ${periodEnd}
- Date: ${new Date(tx.created_date || Date.now()).toLocaleDateString()}
- Transaction ID: ${tx.id}

Your receipt is attached. You can also download it from your MiNest account under "My Payments".

Thank you!
MiNest`;

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: tx.tenant_user_id,
    subject: `Payment Receipt — ${tx.listing_title}`,
    body: emailBody,
  }).catch(err => console.warn('Email send failed:', err.message));

  // Update transaction with receipt URI
  if (receipt_uri) {
    await base44.asServiceRole.entities.PaymentTransaction.update(tx.id, {
      receipt_uri,
    }).catch(err => console.warn('Could not update receipt_uri:', err.message));
  }

  return Response.json({
    receipt_uri,
    message: 'Receipt generated and emailed',
  });
});