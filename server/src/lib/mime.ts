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

function formatAddressList(addresses: string | string[]): string {
  const list = Array.isArray(addresses) ? addresses : [addresses];
  return list.map((address) => address.trim()).filter(Boolean).join(", ");
}

function normalizeMessageId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed.replace(/^<|>$/g, "")}>`;
}

function buildReferences(params: {
  inReplyTo?: string;
  references?: string;
}): string | undefined {
  const inReplyTo = params.inReplyTo?.trim()
    ? normalizeMessageId(params.inReplyTo)
    : "";
  const prior = (params.references ?? "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeMessageId);
  const ids: string[] = [];
  for (const id of [...prior, inReplyTo]) {
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.length ? ids.join(" ") : undefined;
}

export function generateMessageId(fromAddress: string): string {
  const domain =
    fromAddress.includes("@")
      ? fromAddress.slice(fromAddress.lastIndexOf("@") + 1).trim().toLowerCase()
      : "relaybase.local";
  const random = crypto.randomUUID().replace(/-/g, "");
  return `<${random}@${domain || "relaybase.local"}>`;
}

export function buildMimeMessage(params: {
  from: string;
  fromName?: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const messageId =
    params.messageId?.trim()
      ? normalizeMessageId(params.messageId)
      : generateMessageId(params.from);
  const inReplyTo = params.inReplyTo?.trim()
    ? normalizeMessageId(params.inReplyTo)
    : undefined;
  const references = buildReferences({
    inReplyTo: params.inReplyTo,
    references: params.references,
  });

  const headers = [
    `From: ${formatMailboxHeader(params.from, params.fromName)}`,
    `To: ${formatAddressList(params.to)}`,
    ...(params.cc && formatAddressList(params.cc)
      ? [`Cc: ${formatAddressList(params.cc)}`]
      : []),
    ...(params.replyTo?.trim()
      ? [`Reply-To: ${params.replyTo.trim()}`]
      : []),
    `Message-ID: ${messageId}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
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
  ccEmails?: string[];
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
    cc: params.ccEmails?.length ? params.ccEmails : undefined,
    subject: params.subject,
    text: params.bodyText || "(no text body)",
    html: params.bodyHtml ?? undefined,
    messageId: params.messageId ?? undefined,
  });

  const lines = mime.split("\r\n");
  const mimeVersionIdx = lines.findIndex((line) => line.startsWith("MIME-Version:"));
  const insertAt = mimeVersionIdx >= 0 ? mimeVersionIdx : 0;
  const extra = [
    "X-Relaybase-Stripped: 1",
    ...params.attachments.map(
      (attachment) =>
        `X-Relaybase-Attachment: id=${attachment.id}; filename="${attachment.filename.replace(/"/g, '\\"')}"; type=${attachment.contentType}; size=${attachment.size}`,
    ),
  ];
  lines.splice(insertAt, 0, ...extra);

  return new TextEncoder().encode(lines.join("\r\n")).buffer as ArrayBuffer;
}
