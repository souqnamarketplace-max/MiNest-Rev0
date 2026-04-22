/**
 * soundService — lightweight notification sound utility.
 * Uses Web Audio API to generate tones — no external audio files needed.
 * Sounds are only played after user interaction (browser requirement).
 */

let audioCtx = null;
let interactionReady = false;
let lastMessageSound = 0;
let lastNotifSound = 0;
const COOLDOWN_MS = 1500;

// Initialize AudioContext after first user interaction
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Mark ready after any user interaction
function onInteraction() {
  interactionReady = true;
  document.removeEventListener("click", onInteraction);
  document.removeEventListener("keydown", onInteraction);
  document.removeEventListener("touchstart", onInteraction);
}
document.addEventListener("click", onInteraction, { passive: true });
document.addEventListener("keydown", onInteraction, { passive: true });
document.addEventListener("touchstart", onInteraction, { passive: true });

// Check user preference from localStorage
function isSoundEnabled() {
  return localStorage.getItem("minest_sound_enabled") !== "false";
}

function isMessageSoundEnabled() {
  return localStorage.getItem("minest_message_sound_enabled") !== "false";
}

function isNotifSoundEnabled() {
  return localStorage.getItem("minest_notif_sound_enabled") !== "false";
}

export function setSoundEnabled(enabled) {
  localStorage.setItem("minest_sound_enabled", String(enabled));
}

export function setMessageSoundEnabled(enabled) {
  localStorage.setItem("minest_message_sound_enabled", String(enabled));
}

export function setNotifSoundEnabled(enabled) {
  localStorage.setItem("minest_notif_sound_enabled", String(enabled));
}

export function getSoundPreferences() {
  return {
    soundEnabled: isSoundEnabled(),
    messageSoundEnabled: isMessageSoundEnabled(),
    notifSoundEnabled: isNotifSoundEnabled(),
  };
}

/**
 * Play a soft two-tone "message received" sound (WhatsApp-style).
 */
export function playMessageSound() {
  if (!interactionReady || !isSoundEnabled() || !isMessageSoundEnabled()) return;
  const now = Date.now();
  if (now - lastMessageSound < COOLDOWN_MS) return;
  lastMessageSound = now;

  try {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    // Two-note ascending chime
    const notes = [880, 1108.73]; // A5, C#6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.25);
    });
  } catch {
    // Silent fail — audio not critical
  }
}

/**
 * Play a softer single-tone notification sound.
 */
export function playNotificationSound() {
  if (!interactionReady || !isSoundEnabled() || !isNotifSoundEnabled()) return;
  const now = Date.now();
  if (now - lastNotifSound < COOLDOWN_MS) return;
  lastNotifSound = now;

  try {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime); // E5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Silent fail
  }
}