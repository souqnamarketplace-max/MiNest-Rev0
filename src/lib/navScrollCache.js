/**
 * Simple in-memory cache for scroll positions and nested paths per tab.
 * Used by MobileBottomNav to restore scroll & sub-route when re-visiting a tab.
 */
const scrollCache = {};
const pathCache = {};

export function saveScrollPosition(basePath, y) {
  scrollCache[basePath] = y;
}

export function getScrollPosition(basePath) {
  return scrollCache[basePath] ?? 0;
}

export function saveTabPath(basePath, fullPath) {
  pathCache[basePath] = fullPath;
}

export function getTabPath(basePath) {
  return pathCache[basePath] ?? basePath;
}