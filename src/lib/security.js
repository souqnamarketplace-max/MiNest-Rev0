/**
 * security.js — App-wide security utilities
 * SECURITY: These functions protect against common web vulnerabilities
 */

/**
 * Sanitize a string for safe use in URLs, preventing open redirects
 * Only allows relative paths starting with /
 */
export function sanitizeRedirectPath(path) {
  if (typeof path !== 'string') return '/';
  const trimmed = path.trim();
  // Only allow relative paths — reject absolute URLs and protocol-relative URLs
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/dashboard';
  // Reject paths with protocol indicators
  if (/^\/[a-z]+:/i.test(trimmed)) return '/dashboard';
  return trimmed;
}

/**
 * Sanitize user input for display — strips HTML tags
 */
export function sanitizeDisplayText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 10000); // Limit length
}

/**
 * Validate and sanitize CSS color values
 * Only allows safe CSS color formats to prevent CSS injection
 */
export function sanitizeCSSColor(value) {
  if (typeof value !== 'string') return null;
  const safeCSSPattern = /^(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|var\(--[a-zA-Z0-9-]+\)|[a-zA-Z]{2,30})$/;
  return safeCSSPattern.test(value.trim()) ? value.trim() : null;
}

/**
 * Rate limiter for client-side operations
 * Returns { allowed, remainingAttempts, cooldownSeconds }
 */
export class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = [];
  }

  check() {
    const now = Date.now();
    // Remove attempts outside the window
    this.attempts = this.attempts.filter(t => now - t < this.windowMs);
    
    if (this.attempts.length >= this.maxAttempts) {
      const oldestAttempt = this.attempts[0];
      const cooldownMs = this.windowMs - (now - oldestAttempt);
      return {
        allowed: false,
        remainingAttempts: 0,
        cooldownSeconds: Math.ceil(cooldownMs / 1000),
      };
    }

    this.attempts.push(now);
    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - this.attempts.length,
      cooldownSeconds: 0,
    };
  }

  reset() {
    this.attempts = [];
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim()) && email.length <= 255;
}

/**
 * Sanitize file names for safe use
 */
export function sanitizeFileName(name) {
  if (typeof name !== 'string') return 'file';
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}
