export function renderDownloadPage(opts: {
  dmgUrl: string | null;
  filePath: string;
}): Response {
  const href = opts.dmgUrl ? opts.filePath : null;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download Relaybase</title>
  <link rel="icon" href="/icon.png" />
  <style>
    :root {
      --fg: #171717;
      --muted: #737373;
      --brand: #2563eb;
      --border: #e5e5e5;
      --bg: #fafafa;
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
    p { margin: 0.6rem 0 0; color: var(--muted); line-height: 1.5; font-size: 0.95rem; }
    a.btn {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.7rem 1.15rem;
      border-radius: 0.6rem;
      background: var(--brand);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
    }
    a.btn:hover { filter: brightness(0.95); }
    .missing { margin-top: 1.5rem; color: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/icon.png" alt="" />
    <div class="badge">Beta</div>
    <h1>Download Relaybase</h1>
    <p>macOS app for your Cloudflare domains. Apple Silicon.</p>
    ${
      href
        ? `<a class="btn" href="${href}">Download for Mac</a>`
        : `<p class="missing">The installer is not available yet. Try again shortly.</p>`
    }
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
