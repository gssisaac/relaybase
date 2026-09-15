export function unsubscribeHtmlPage(opts: {
  heading: string;
  subtext: string;
  footer?: string;
  formAction?: string;
}): string {
  const form =
    opts.formAction ?
      `<form method="post" action="${opts.formAction}" style="margin-top:16px;">
  <button type="submit" class="button">Confirm unsubscribe</button>
</form>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.heading}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#0f172a; }
  main { max-width:420px; margin:24px; padding:40px 32px; background:#fff; border-radius:12px; border:1px solid #e2e8f0; text-align:center; }
  h1 { font-size:18px; margin:0 0 8px; }
  p { font-size:14px; line-height:1.6; color:#475569; margin:0 0 16px; }
  button.button, a.button { display:inline-block; margin-top:8px; padding:8px 16px; border-radius:6px; background:#0f172a; color:#fff; text-decoration:none; font-size:13px; border:0; cursor:pointer; }
  a.link { color:#0f172a; font-size:13px; }
  footer { margin-top:16px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
<main>
  <h1>${opts.heading}</h1>
  <p>${opts.subtext}</p>
  ${form}
  ${opts.footer ?? ""}
</main>
</body>
</html>`;
}

export function unsubscribePath(broadcastId: string, token: string): string {
  return `/crm/unsubscribe/${broadcastId}/${token}`;
}
