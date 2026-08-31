export function parseUserAgent(ua: string): { browser: string; os: string } {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? "Safari"
    : "Unknown";

  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Windows NT/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown";

  return { browser, os };
}
