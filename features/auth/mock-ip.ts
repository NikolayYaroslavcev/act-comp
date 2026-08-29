/**
 * IP cannot be determined server-side without a real network layer (Vercel
 * demo, no DB) and must never be read from the client. Per master-plan
 * section 6, it's an independent demo mock in the TEST-NET-1 documentation
 * range (RFC 5737), explicitly tagged "(demo)" so it's never mistaken for a
 * real client IP.
 */
export function generateMockIp(): string {
  const lastOctet = Math.floor(Math.random() * 256);
  return `192.0.2.${lastOctet} (demo)`;
}
