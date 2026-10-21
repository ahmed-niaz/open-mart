/**
 * Masks customer email address for non-privileged administrative roles.
 * e.g., 'customer@domain.com' -> 'c***r@domain.com'
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const parts = email.split('@');
  if (parts.length !== 2) {
    return '***';
  }
  const [localPart, domainPart] = parts;
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domainPart}`;
  }
  const maskedLocal = `${localPart[0]}***${localPart[localPart.length - 1]}`;
  return `${maskedLocal}@${domainPart}`;
}

/**
 * Masks customer name.
 * e.g., 'John Doe' -> 'John D.'
 */
export function maskName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';

  if (!f && !l) {
    return 'Anonymous Customer';
  }
  if (!l) {
    return f;
  }
  if (!f) {
    return l;
  }
  return `${f} ${l[0]}.`;
}

/**
 * Masks customer phone number.
 * e.g., '+8801712345678' -> '+880****5678'
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }
  const clean = phone.trim();
  if (clean.length < 7) {
    return '***';
  }
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}****${suffix}`;
}
