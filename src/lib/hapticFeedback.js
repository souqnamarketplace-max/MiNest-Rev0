/**
 * Haptic Feedback Utility
 * Provides subtle haptic feedback for key interactions
 * Can be disabled via user preferences
 */

export const HapticPatterns = {
  LIGHT_TAP: 'light',        // Light feedback for button press
  MEDIUM_TAP: 'medium',      // Medium feedback for selections
  HEAVY_IMPACT: 'heavy',     // Strong feedback for success
  SUCCESS: 'success',        // Success pattern (pattern of taps)
  ERROR: 'error',            // Error pattern (strong pulse)
  PULL_REFRESH: 'pull',      // Pull-to-refresh feedback
};

/**
 * Trigger haptic feedback if supported and enabled
 * @param {string} pattern - Haptic pattern from HapticPatterns
 * @param {boolean} isEnabled - Whether haptic is enabled (check user preference)
 */
export function triggerHaptic(pattern = HapticPatterns.LIGHT_TAP, isEnabled = true) {
  if (!isEnabled || typeof window === 'undefined') return;

  // Check browser support
  if (!navigator.vibrate && !navigator.webkitVibrate && !navigator.mozVibrate && !navigator.msVibrate) {
    return;
  }

  const vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;
  
  // Vibration patterns (milliseconds)
  const patterns = {
    [HapticPatterns.LIGHT_TAP]: [10],
    [HapticPatterns.MEDIUM_TAP]: [20],
    [HapticPatterns.HEAVY_IMPACT]: [40],
    [HapticPatterns.SUCCESS]: [10, 50, 10, 50, 10], // Tap, pause, tap, pause, tap
    [HapticPatterns.ERROR]: [30, 30, 30],            // Triple pulse
    [HapticPatterns.PULL_REFRESH]: [15, 10, 15],
  };

  const vibratePattern = patterns[pattern] || patterns[HapticPatterns.LIGHT_TAP];
  
  try {
    vibrate.call(navigator, vibratePattern);
  } catch (err) {
    // Silently fail if vibration not available
    console.debug('Haptic feedback not available:', err.message);
  }
}

/**
 * Get haptic preference from localStorage
 * @returns {boolean} Whether haptic feedback is enabled
 */
export function isHapticEnabled() {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('haptic_feedback_enabled');
  // Default to true if not set (opt-out model)
  return stored === null || stored === 'true';
}

/**
 * Set haptic preference
 * @param {boolean} enabled - Whether to enable haptic feedback
 */
export function setHapticEnabled(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('haptic_feedback_enabled', enabled.toString());
}

/**
 * React hook to use haptic feedback with user preference
 * @returns {function} Function to trigger haptic with auto-check of user preference
 */
export function useHaptic() {
  return (pattern = HapticPatterns.LIGHT_TAP) => {
    triggerHaptic(pattern, isHapticEnabled());
  };
}