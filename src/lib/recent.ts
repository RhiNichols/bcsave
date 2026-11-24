// Dogs this visitor has opened, newest first.
//
// Lives only in the one browser that did the looking: localStorage is
// per-origin, never leaves the device and never reaches the rescue, so there
// is nothing here to store, secure or disclose.
//
// Every access is wrapped. localStorage does not merely return null when a
// browser is set to block site data — it throws on access — and a visitor in
// that mode should still get a working page, just without this feature.

const KEY = "bcsave:recent-dogs";

// Enough to cover an evening of browsing without the filter becoming a second
// copy of the full list.
const CAP = 12;

export function recentIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, CAP);
  } catch {
    return [];
  }
}

export function remember(id: string) {
  if (!id) return;
  try {
    // Re-visiting a dog moves them back to the front rather than duplicating.
    const next = [id, ...recentIds().filter((v) => v !== id)].slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
