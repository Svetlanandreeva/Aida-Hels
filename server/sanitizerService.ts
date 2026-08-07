/**
 * Sanitizer Service - PII Anonymization Service
 * Sanitizes personal identifiable information (PII) before passing prompt data
 * to external LLM endpoints (Gemini/OpenAI).
 */

export function sanitizeText(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Anonymize Full Names (ФИО)
    .replace(/[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?/g, '[ИМЯ_ПАЦИЕНТА]')
    // Anonymize Emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[ЭЛЕКТРОННАЯ ПОЧТА]')
    // Anonymize Phone numbers
    .replace(/(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, '[ТЕЛЕФОН]')
    // Anonymize Exact Dates of birth
    .replace(/\b\d{2}[\.\/]\d{2}[\.\/]\d{4}\b/g, '[Дата рождения]');
}

/**
 * Calculates user age in full years without exposing exact birth date to LLM
 */
export function calculateAgeInYears(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  let birth: Date;

  if (birthDateStr.includes('.')) {
    const parts = birthDateStr.split('.');
    if (parts.length === 3) {
      birth = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else {
      birth = new Date(birthDateStr);
    }
  } else {
    birth = new Date(birthDateStr);
  }

  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}
