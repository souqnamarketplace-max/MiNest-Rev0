/**
 * POST /api/ai/invoke
 * Proxies all invokeLLM calls from the frontend to Anthropic API.
 * Handles both plain text and JSON schema responses.
 * Used for:
 * - Bio rewrite (Profile.jsx)
 * - Listing title rewrite (CreateListing.jsx, EditListing.jsx, ListingEditModal.jsx)
 * - Listing description rewrite (same files)
 * - House rules generator (RoommateAgreementGenerator.jsx)
 *
 * Security: requires authenticated user (Bearer token).
 * Rate limiting: enforced by Vercel (can add custom limits later).
 */
import { getAuthUser } from '../_lib/supabase.js';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 1024;

// System prompt — keeps responses on-topic and safe
const SYSTEM_PROMPT = `You are a helpful writing assistant for MiNest, a Canadian room rental platform.
You help users improve their profile bios, listing titles, listing descriptions, and house rules.
Always respond in English unless the original text is in French.
Be concise, friendly, and professional. Never include harmful, discriminatory, or inappropriate content.
Never make up facts about a property or person.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Require authenticated user
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { prompt, response_json_schema } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Build messages — if JSON schema requested, add instruction
    let fullPrompt = prompt;
    if (response_json_schema) {
      fullPrompt += `\n\nRespond ONLY with valid JSON matching this schema. No markdown, no explanation:\n${JSON.stringify(response_json_schema, null, 2)}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[ai/invoke] Anthropic error:', response.status, errBody);
      return res.status(502).json({ error: `AI service error: ${response.status}` });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    // If JSON schema was requested, parse and return the object
    if (response_json_schema) {
      try {
        const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return res.status(200).json(parsed);
      } catch {
        // Fallback: return raw text if JSON parse fails
        return res.status(200).json({ text: rawText });
      }
    }

    // Plain text response
    return res.status(200).json({ text: rawText.trim() });
  } catch (error) {
    console.error('[ai/invoke] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
