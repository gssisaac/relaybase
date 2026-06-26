function escapeDisplayName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function formatMailboxHeader(
  address: string,
  displayName?: string,
): string {
  const name = displayName?.trim();
  if (!name) return address.trim();
  return `"${escapeDisplayName(name)}" <${address.trim()}>`;
}

export function buildMimeMessage(params: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): string {
  const headers = [
    `From: ${formatMailboxHeader(params.from, params.fromName)}`,
    `To: ${params.to.trim()}`,
    ...(params.replyTo?.trim()
      ? [`Reply-To: ${params.replyTo.trim()}`]
      : []),
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
  ];

  const html = params.html?.trim();
  if (html) {
    const boundary = `relaybase-${Date.now().toString(36)}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      params.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  return [
    ...headers,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    params.text,
    "",
  ].join("\r\n");
}

/** Body-only archive MIME; attachment binaries live in R2 separately. */
export function buildStrippedInboundMime(params: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  messageId: string | null;
  bodyText: string;
  bodyHtml: string | null;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
}): ArrayBuffer {
  const mime = buildMimeMessage({
    from: params.fromEmail,
    to: params.toEmail,
    subject: params.subject,
    text: params.bodyText || "(no text body)",
    html: params.bodyHtml ?? undefined,
  });

  const lines = mime.split("\r\n");
  const mimeVersionIdx = lines.findIndex((line) => line.startsWith("MIME-Version:"));
  const insertAt = mimeVersionIdx >= 0 ? mimeVersionIdx : 0;
  const extra = [
    ...(params.messageId ? [`Message-ID: ${params.messageId}`] : []),
    "X-Relaybase-Stripped: 1",
    ...params.attachments.map(
      (attachment) =>
        `X-Relaybase-Attachment: id=${attachment.id}; filename="${attachment.filename.replace(/"/g, '\\"')}"; type=${attachment.contentType}; size=${attachment.size}`,
    ),
  ];
  lines.splice(insertAt, 0, ...extra);

  return new TextEncoder().encode(lines.join("\r\n")).buffer as ArrayBuffer;
}
