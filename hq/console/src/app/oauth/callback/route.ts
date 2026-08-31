import { getEnv } from "@/lib/env";

/**
 * Cloudflare OAuth authorization-code callback (browser landing). Public.
 *
 * The OAuth client is a PUBLIC client (Token Authentication Method: None /
 * PKCE) — there is no client secret. The desktop generated the PKCE
 * `code_verifier` and `code_challenge` and opened the authorize URL; the
 * desktop will exchange the code itself. So this callback does NOT exchange
 * the code — it simply relays `code` + `state` to the `relaybase://` deep
 * link, which the Tauri app catches and completes the exchange.
 *
 * No CF user credentials are stored on the console (there is no secret to
 * hold and no token exchange here). The tokens are minted on the desktop and
 * saved to ~/.relaybase.
 */
export async function GET(req: Request) {
  await getEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error") ?? "";

  if (error) {
    return renderDone(`Authorization failed: ${error}`, true);
  }
  if (!code || !state) {
    return renderDone("Missing code or state in OAuth callback.", true);
  }

  // Relay the code + state to the desktop via a deep link. The desktop
  // validates `state` (CSRF) and exchanges `code` + its PKCE `code_verifier`
  // directly with Cloudflare (no client secret — public PKCE client).
  const qs = new URLSearchParams({ state, code }).toString();
  const deepLink = `relaybase://oauth/callback?${qs}`;
  // tauri:dev on macOS often does not register the custom scheme. The
  // desktop always listens on this loopback port (dev + production).
  const loopback = `http://127.0.0.1:32831/oauth/callback?${qs}`;

  return renderRedirect(deepLink, loopback);
}

function renderRedirect(deepLink: string, loopback: string): Response {
  const safeDeep = escapeHtml(deepLink);
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relaybase — finishing connection…</title><style>body{font-family:system-ui,sans-serif;background:#0b0d10;color:#e6e6e6;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;padding:2rem}.card{max-width:28rem;text-align:center}.card h1{font-size:1.1rem;margin:0 0 .5rem}.card p{color:#9aa0a6;font-size:.9rem;margin:.25rem 0}a{color:#f59e0b}</style></head><body><div class="card"><h1>Finishing Cloudflare connection…</h1><p id="status">Returning you to the Relaybase app.</p><p>If nothing happens, <a href="${safeDeep}">click here to open Relaybase</a>.</p></div><script>
(async function () {
  var deep = ${JSON.stringify(deepLink)};
  var loopback = ${JSON.stringify(loopback)};
  var status = document.getElementById("status");
  try {
    var res = await fetch(loopback, { mode: "cors", cache: "no-store" });
    if (res.ok) {
      status.textContent = "Connected. You can close this tab and return to Relaybase.";
      return;
    }
  } catch (e) {}
  window.location.replace(deep);
})();
</script></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderDone(message: string, isError: boolean): Response {
  const title = isError ? "Relaybase — Cloudflare connection failed" : "Relaybase — Cloudflare connected";
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;background:#0b0d10;color:#e6e6e6;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;padding:2rem}.card{max-width:28rem;text-align:center}.card h1{font-size:1.1rem;margin:0 0 .5rem}.card p{color:#9aa0a6;font-size:.9rem;margin:.25rem 0}</style></head><body><div class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p>Return to the Relaybase app and try again.</p></div></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
