/** Normalize browser Origin values before comparing them with trusted origins. */
export function matchesAllowedOrigin(originHeader: string, allowedOrigins: Iterable<string>): boolean {
  try {
    const requestOrigin = new URL(originHeader);
    if (!['http:', 'https:'].includes(requestOrigin.protocol) || requestOrigin.username || requestOrigin.password) return false;
    const normalizedOrigin = requestOrigin.origin;
    for (const allowed of allowedOrigins) {
      try {
        const trustedOrigin = new URL(allowed);
        if (trustedOrigin.origin === normalizedOrigin) return true;
      } catch {
        // Ignore malformed values rather than weakening the allow-list.
      }
    }
    return false;
  } catch {
    return false;
  }
}
