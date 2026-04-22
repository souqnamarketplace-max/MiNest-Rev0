/**
 * entities.js — Drop-in Supabase replacement for all entities.* calls
 * FIX #1: user.email as ID → user.id (UUID) everywhere
 * FIX #2: MongoDB operators ($regex, $gte, $lte, $in) → Supabase equivalents
 */
import { supabase } from '@/lib/supabase';

function applyFilters(query, filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, operand] of Object.entries(value)) {
        if (op === '$gte') query = query.gte(key, operand);
        else if (op === '$lte') query = query.lte(key, operand);
        else if (op === '$gt') query = query.gt(key, operand);
        else if (op === '$lt') query = query.lt(key, operand);
        else if (op === '$in') query = query.in(key, operand);
        else if (op === '$regex') query = query.ilike(key, `%${operand}%`);
      }
    } else if (Array.isArray(value)) {
      query = query.contains(key, value);
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

function applySort(query, sort) {
  if (!sort) return query;
  const desc = sort.startsWith('-');
  const raw = (desc ? sort.slice(1) : sort)
    .replace('created_date', 'created_at')
    .replace('updated_date', 'updated_at')
    .replace('last_message_date', 'last_message_at');
  return query.order(raw, { ascending: !desc });
}

// Add backward-compatible aliases so code that reads old field names still works
// This avoids breaking ~20 files that read created_date, text, etc.
function addAliases(row) {
  if (!row || typeof row !== 'object') return row;
  // Date aliases: created_at ↔ created_date, updated_at ↔ updated_date
  if (row.created_at && !row.created_date) row.created_date = row.created_at;
  if (row.updated_at && !row.updated_date) row.updated_date = row.updated_at;
  // Messages: content ↔ text
  if (row.content !== undefined && row.text === undefined) row.text = row.content;
  // Messages: sender_user_id ↔ sender_id
  if (row.sender_user_id && !row.sender_id) row.sender_id = row.sender_user_id;
  // Messages: is_read ↔ read (for messages table only, notifications already has 'read')
  if (row.is_read !== undefined && row.read === undefined) row.read = row.is_read;
  // Bookings: checkin_date ↔ check_in, checkout_date ↔ check_out
  if (row.checkin_date && !row.check_in) row.check_in = row.checkin_date;
  if (row.checkout_date && !row.check_out) row.check_out = row.checkout_date;
  return row;
}

function aliasRows(data) {
  if (Array.isArray(data)) return data.map(addAliases);
  return addAliases(data);
}

function makeEntity(table) {
  return {
    filter: async (filters = {}, sort = '-created_at', limit = 100) => {
      let query = supabase.from(table).select('*');
      query = applyFilters(query, filters);
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return aliasRows(data ?? []);
    },
    list: async (sort = '-created_at', limit = 100) => {
      let query = supabase.from(table).select('*');
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return aliasRows(data ?? []);
    },
    get: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return addAliases(data);
    },
    create: async (payload) => {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return addAliases(data);
    },
    update: async (id, payload) => {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return addAliases(data);
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    // FIX #6: Replaces 5s polling with Supabase Realtime
    subscribe: (callback) => {
      const channel = supabase
        .channel(`${table}_realtime_${Math.random()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

export const entities = {
  Listing:                makeEntity('listings'),
  UserProfile:            makeEntity('user_profiles'),
  SeekerProfile:          makeEntity('seeker_profiles'),
  Conversation:           makeEntity('conversations'),
  Message:                makeEntity('messages'),
  Favorite:               makeEntity('favorites'),
  ViewingAppointment:     makeEntity('viewing_appointments'),
  RentalAgreement:        makeEntity('rental_agreements'),
  PaymentPlan:            makeEntity('payment_plans'),
  TenantSubscription:     makeEntity('tenant_subscriptions'),
  PaymentTransaction:     makeEntity('payment_transactions'),
  DepositRefund:          makeEntity('deposit_refunds'),
  PaymentDispute:         makeEntity('payment_disputes'),
  StripeConnectAccount:   makeEntity('stripe_connect_accounts'),
  UserVerification:       makeEntity('user_verifications'),
  VerificationSettings:   makeEntity('verification_settings'),
  CommissionRule:         makeEntity('commission_rules'),
  BoostSettings:          makeEntity('boost_settings'),
  Notification:           makeEntity('notifications'),
  NotificationPreference: makeEntity('notification_preferences'),
  ContactMessage:         makeEntity('contact_messages'),
  SavedSearch:            makeEntity('saved_searches'),
  Report:                 makeEntity('reports'),
  DeviceToken:            makeEntity('device_tokens'),
  Booking:                makeEntity('bookings'),
};

// Upload file to Supabase Storage
// FIX: Replaces base44.integrations.Core.UploadFile
// Allowed file types for uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadFile(file, bucket = 'listing-photos') {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }

  // Validate file type based on bucket
  const allowedTypes = bucket.includes('photo') || bucket.includes('listing') || bucket.includes('profile')
    ? ALLOWED_IMAGE_TYPES
    : [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed. Accepted: ${allowedTypes.join(', ')}`);
  }

  // Sanitize filename — remove special characters
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = safeName.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: data.publicUrl };
}

// Invoke a Vercel API function
// FIX: Replaces invokeFunction(name, payload)
export async function invokeFunction(name, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Function ${name} failed: ${res.statusText}`);
  return res.json();
}

// Invoke AI — ALWAYS routes through server-side proxy
// SECURITY: API key is NEVER exposed to client bundle
// Use ANTHROPIC_API_KEY (no VITE_ prefix) in server environment only
export async function invokeLLM({ prompt, response_json_schema } = {}) {
  // Always use server-side proxy — never call Anthropic directly from browser
  // This protects the API key from being exposed in the client bundle
  const result = await invokeFunction('ai/invoke', { prompt, response_json_schema });
  return result.text ?? result;
}
