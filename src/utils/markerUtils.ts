/**
 * Normalizes medical marker names for accurate deduplication and matching.
 * Handles Latin/Cyrillic character mixing (e.g., 'd' vs 'д', 'b' vs 'в')
 * and extracts canonical marker keys (e.g., Vitamin D, TSH, Ferritin, etc.).
 */
export function normalizeMarkerName(name: string): string {
  if (!name) return '';
  const lower = name.toLowerCase().trim();

  // Direct keyword matching for common medical markers
  if (
    lower.includes('витамин d') ||
    lower.includes('витамин д') ||
    lower.includes('25-oh') ||
    lower.includes('кальциферол') ||
    lower.includes('vitamin d') ||
    lower.includes('25-гидрокси')
  ) {
    return 'marker_vitamin_d';
  }

  if (lower.includes('ферритин') || lower.includes('ferritin')) {
    return 'marker_ferritin';
  }

  if (lower.includes('ттг') || lower.includes('tsh') || lower.includes('тиреотроп')) {
    return 'marker_tsh';
  }

  if (
    lower.includes('витамин b12') ||
    lower.includes('витамин в12') ||
    lower.includes('b12') ||
    lower.includes('в12') ||
    lower.includes('цианокобаламин') ||
    lower.includes('vitamin b12')
  ) {
    return 'marker_b12';
  }

  if (lower.includes('гемоглобин') || lower.includes('hemoglobin') || lower.includes('hgb')) {
    return 'marker_hemoglobin';
  }

  if (lower.includes('глюкоза') || lower.includes('glucose') || lower.includes('гликированный') || lower.includes('hba1c')) {
    return 'marker_glucose';
  }

  if (lower.includes('холестерин') || lower.includes('cholesterol')) {
    return 'marker_cholesterol';
  }

  // Fallback: clean all non-alphanumeric chars keeping cyrillic and latin
  const clean = lower.replace(/[^a-zа-я0-9]/gi, '');
  return clean.slice(0, 25) || lower;
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
