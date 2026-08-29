const DEMO_PREFIX = "demo:";

/**
 * data.json seeds passwordHash as "demo:<plaintext>" — a stand-in for a real
 * hashing scheme, matching master-plan's "no backend/no DB" demo constraint.
 */
export function verifyPassword(passwordHash: string, password: string): boolean {
  if (!passwordHash.startsWith(DEMO_PREFIX)) {
    return false;
  }
  return passwordHash.slice(DEMO_PREFIX.length) === password;
}
