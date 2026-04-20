/**
 * Single source of truth for payment formatting and status helpers.
 */

export function formatCents(cents, currency = 'CAD') {
  if (!cents && cents !== 0) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export const SUBSCRIPTION_STATUS_CONFIG = {
  active:     { label: 'Active',      color: 'bg-accent/10 text-accent' },
  trialing:   { label: 'Trial',       color: 'bg-secondary/10 text-secondary' },
  past_due:   { label: 'Past Due',    color: 'bg-destructive/10 text-destructive' },
  canceled:   { label: 'Cancelled',   color: 'bg-muted text-muted-foreground' },
  unpaid:     { label: 'Unpaid',      color: 'bg-destructive/10 text-destructive' },
  incomplete: { label: 'Pending',     color: 'bg-yellow-500/10 text-yellow-600' },
};

export const TRANSACTION_STATUS_CONFIG = {
  succeeded: { label: 'Paid',     color: 'bg-accent/10 text-accent' },
  pending:   { label: 'Pending',  color: 'bg-yellow-500/10 text-yellow-600' },
  failed:    { label: 'Failed',   color: 'bg-destructive/10 text-destructive' },
  refunded:  { label: 'Refunded', color: 'bg-muted text-muted-foreground' },
};

export const DISPUTE_STATUS_CONFIG = {
  open:                 { label: 'Open',               color: 'bg-yellow-500/10 text-yellow-600' },
  under_review:         { label: 'Under Review',       color: 'bg-secondary/10 text-secondary' },
  resolved_for_tenant:  { label: 'Resolved (Tenant)',  color: 'bg-accent/10 text-accent' },
  resolved_for_owner:   { label: 'Resolved (Owner)',   color: 'bg-accent/10 text-accent' },
  closed:               { label: 'Closed',             color: 'bg-muted text-muted-foreground' },
};

export function getSubscriptionStatusConfig(status) {
  return SUBSCRIPTION_STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground' };
}

export function getTransactionStatusConfig(status) {
  return TRANSACTION_STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground' };
}

export function getIntervalLabel(interval) {
  return { month: 'Monthly', week: 'Weekly', year: 'Yearly' }[interval] || interval;
}