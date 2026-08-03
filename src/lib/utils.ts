/**
 * Formats a passport URL stored in the database.
 * If it is a base64 string or an uploads path, it returns a unified endpoint /api/uploads/passport/[userId].
 * This avoids returning massive base64 strings in JSON payloads.
 */
export function formatPassportUrl(userId: string, passportUrl: string | null): string | null {
  if (!passportUrl) return null;
  if (
    passportUrl.startsWith("data:") || 
    passportUrl.startsWith("/api/uploads/") || 
    passportUrl.startsWith("/uploads/")
  ) {
    return `/api/uploads/passport/${userId}`;
  }
  return passportUrl;
}
