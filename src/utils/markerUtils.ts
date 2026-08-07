/**
 * Normalizes medical marker names for accurate deduplication and matching.
 * Handles Latin/Cyrillic character mixing (e.g., 'd' vs 'д', 'b' vs 'в')
 * and extracts canonical marker keys (e.g., Vitamin D, TSH, Ferritin, etc.).
 */
export function normalizeMarkerName(name: string): string {
  if (!name) return '';
  const lower = name.toLowerCase().trim();

  // Normalize Cyrillic/Latin equivalents
  const normalized = lower
    .replace(/д/g, 'd')
    .replace(/в/g, 'b')
    .replace(/с/g, 'c')
    .replace(/а/g, 'a')
    .replace(/о/g, 'o')
    .replace(/е/g, 'e')
    .replace(/р/g, 'p')
    .replace(/х/g, 'x');

  const clean = normalized.replace(/[^a-z0-9]/g, '');

  // Check for known canonical medical markers
  if (clean.includes('vitamind') || clean.includes('25oh') || clean.includes('кальциферол') || clean.includes('витамиnd')) {
    return 'marker_vitamin_d';
  }
  if (clean.includes('ferritin') || clean.includes('ферритин')) {
    return 'marker_ferritin';
  }
  if (clean.includes('tsh') || clean.includes('ттг') || clean.includes('тиреотроп')) {
    return 'marker_tsh';
  }
  if (clean.includes('vitaminb12') || clean.includes('витамиnb12') || clean.includes('цианокобаламин')) {
    return 'marker_b12';
  }
  if (clean.includes('hemoglobin') || clean.includes('гемоглобин')) {
    return 'marker_hemoglobin';
  }
  if (clean.includes('glucose') || clean.includes('глюкоза')) {
    return 'marker_glucose';
  }
  if (clean.includes('cholesterol') || clean.includes('холестерин')) {
    return 'marker_cholesterol';
  }

  // Fallback to the cleaned string or a prefix
  return clean.slice(0, 20) || lower;
}

/**
 * Deduplicates array of markers or deviations by their canonical key.
 * Keeps the first occurrence (or prefers entries with values).
 */
export function deduplicateMarkers<T extends { marker: string }>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];

  const seenKeys = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (!item || !item.marker) continue;

    const key = normalizeMarkerName(item.marker);
    if (!key) continue;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(item);
    }
  }

  return result;
}
