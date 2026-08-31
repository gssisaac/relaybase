function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderDownloadPage(opts: {
  dmgUrl: string | null;
  filePath: string;
  version: string | null;
}): Response {
  const href = opts.dmgUrl ? opts.filePath : null;
  const versionLabel = opts.version ? escapeHtml(opts.version) : null;
  const macButton = versionLabel
    ? `Download Mac app ${versionLabel} (Universal)`
    : "Download Mac app (Universal)";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download Relaybase</title>
  <link rel="icon" href="/icon.png" />
  <style>
    :root {
      --fg: #0f172a;
      --muted: #64748b;
      --brand: #e85d2a;
      --border: #e2e8f0;
      --bg: #f8fafc;
      --well: #f1f5f9;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      color: var(--fg);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.25rem;
    }
    .card {
      width: 100%;
      max-width: 28rem;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2rem 1.75rem;
      text-align: center;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
    }
    img { width: 48px; height: 48px; }
    .badge {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.15rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #0f766e;
      background: #ccfbf1;
    }
    h1 { margin: 0.85rem 0 0; font-size: 1.5rem; letter-spacing: -0.02em; }
    .lead { margin: 0.6rem 0 0; color: var(--muted); line-height: 1.5; font-size: 0.95rem; }
    .platforms { margin-top: 1.5rem; display: grid; gap: 0.75rem; text-align: left; }
    .row {
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 0.9rem 1rem;
      background: #fff;
    }
    .row.soon { background: var(--well); }
    .os {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--muted);
    }
    a.btn {
      display: inline-block;
      margin-top: 0.65rem;
      padding: 0.7rem 1.15rem;
      border-radius: 0.6rem;
      background: var(--brand);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    a.btn:hover { filter: brightness(0.95); }
    .soon-label {
      margin-top: 0.45rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--muted);
    }
    .missing { margin-top: 0.65rem; color: #b91c1c; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/icon.png" alt="" />
    <div class="badge">Beta</div>
    <h1>Download Relaybase</h1>
    <p class="lead">Mac is available now as a Universal build. Windows is coming soon.</p>
    <div class="platforms">
      <div class="row">
        <div class="os">Mac</div>
        ${
          href
            ? `<a class="btn" href="${href}">${macButton}</a>`
            : `<p class="missing">The installer is not available yet. Try again shortly.</p>`
        }
      </div>
      <div class="row soon">
        <div class="os">Windows</div>
        <p class="soon-label">Coming soon</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function renderNotFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
