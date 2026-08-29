function detectBrowser(ua: string): string {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Unknown browser";
}

function detectOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iOS")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown OS";
}

/**
 * Device is derived server-side from the request's User-Agent header — the
 * client never reports it (see master-plan section 6: IP and device are two
 * independent mocks, and IP is not derivable client-side at all).
 */
export function parseDevice(userAgent: string | null): string {
  if (!userAgent) {
    return "Unknown device";
  }
  return `${detectBrowser(userAgent)} on ${detectOS(userAgent)}`;
}
