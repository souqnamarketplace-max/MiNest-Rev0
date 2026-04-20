import { entities } from '@/api/entities';

export async function registerToken(userId, token, platform = 'web', appVersion = null) {
  if (!userId || !token) return null;
  try {
    const existing = await entities.DeviceToken.filter({ user_id: userId, token });
    const now = new Date().toISOString();
    if (existing.length > 0) {
      return entities.DeviceToken.update(existing[0].id, { updated_at: now });
    }
    return entities.DeviceToken.create({ user_id: userId, token, platform });
  } catch (err) {
    console.error('[deviceTokenService] Failed to register token:', err);
    return null;
  }
}

export async function deactivateTokens(userId) {
  try {
    const tokens = await entities.DeviceToken.filter({ user_id: userId });
    await Promise.all(tokens.map(t => entities.DeviceToken.delete(t.id)));
  } catch (err) {
    console.error('[deviceTokenService] Failed to deactivate tokens:', err);
  }
}
